// studio/src/components/ModelViewer.jsx

import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Interactive STL viewer, in the spirit of GitHub's.
 *
 * The file list comes from the loaded session's own `export_model` commands,
 * so it only ever offers models this session actually produces. The bridge
 * serves $BLENDER_ASSETS_DIR read-only at /models.
 *
 * Everything is disposed on unmount/reload — a WebGL context and its buffers
 * are not garbage-collected on their own, and Studio can swap sessions many
 * times in a sitting.
 */
export default function ModelViewer({ apiBase, session }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const [selected, setSelected] = useState('');
    const [status, setStatus] = useState(null);
    const [wireframe, setWireframe] = useState(false);
    const [info, setInfo] = useState(null);

    // Filenames this session exports, in command order, de-duplicated.
    const exports = useMemo(() => {
        const out = [];
        for (const cmd of (session && session.commands) || []) {
            if (cmd.tool !== 'export_model') continue;
            const fp = cmd.arguments && cmd.arguments.filepath;
            if (typeof fp === 'string' && fp && !out.includes(fp)) out.push(fp);
        }
        return out;
    }, [session]);

    useEffect(() => {
        if (exports.length && !exports.includes(selected)) setSelected(exports[0]);
        if (!exports.length && selected) setSelected('');
    }, [exports, selected]);

    // ── set up the scene once ────────────────────────────────────────────
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return undefined;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x2b2b2b);

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        mount.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.0));
        const key = new THREE.DirectionalLight(0xffffff, 2.0);
        key.position.set(1, -1, 1.5);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.8);
        fill.position.set(-1, 1, 0.5);
        scene.add(fill);

        let raf = 0;
        const tick = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(tick); };
        tick();

        const resize = () => {
            const w = mount.clientWidth || 1;
            const h = mount.clientHeight || 1;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(mount);

        sceneRef.current = { scene, camera, renderer, controls, mesh: null, edges: null };

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            controls.dispose();
            const cur = sceneRef.current;
            if (cur && cur.mesh) {
                cur.mesh.geometry.dispose();
                cur.mesh.material.dispose();
            }
            if (cur && cur.edges) {
                cur.edges.geometry.dispose();
                cur.edges.material.dispose();
            }
            renderer.dispose();
            if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
            sceneRef.current = null;
        };
    }, []);

    // ── (re)load the selected STL ────────────────────────────────────────
    useEffect(() => {
        const ctx = sceneRef.current;
        if (!ctx || !selected || !apiBase) return;
        let cancelled = false;
        setStatus('loading');
        setInfo(null);

        // Cache-bust: a re-export writes the SAME filename, so without this the
        // browser would keep showing the previous build.
        const url = `${apiBase}/models/${selected}?t=${Date.now()}`;
        new STLLoader().load(
            url,
            (geometry) => {
                if (cancelled) return;
                const { scene, camera, controls } = ctx;
                if (ctx.mesh) {
                    scene.remove(ctx.mesh);
                    ctx.mesh.geometry.dispose();
                    ctx.mesh.material.dispose();
                }
                if (ctx.edges) {
                    scene.remove(ctx.edges);
                    ctx.edges.geometry.dispose();
                    ctx.edges.material.dispose();
                    ctx.edges = null;
                }
                geometry.computeVertexNormals();
                geometry.computeBoundingBox();
                const bb = geometry.boundingBox;
                const size = new THREE.Vector3();
                bb.getSize(size);
                const centre = new THREE.Vector3();
                bb.getCenter(centre);
                // Sit the part on the origin so orbiting feels natural.
                geometry.translate(-centre.x, -centre.y, -centre.z);

                const material = new THREE.MeshPhongMaterial({
                    color: 0xd8d8d8, specular: 0x111111, shininess: 30,
                });
                const mesh = new THREE.Mesh(geometry, material);
                // STL is Z-up, three.js is Y-up.
                mesh.rotation.x = -Math.PI / 2;
                scene.add(mesh);
                ctx.mesh = mesh;

                // Edge overlay rather than material.wireframe. STL stores only
                // triangles, so a flat wall arrives as two triangles with a
                // diagonal across it -- 42% of this mesh is such slivers, and
                // drawing every triangle edge turns the part into a cobweb.
                // EdgesGeometry keeps only edges where the faces actually meet
                // at more than the threshold angle, i.e. the real silhouette.
                // 35 deg: high enough to drop the rounded-corner tessellation
                // (each arc facet meets its neighbour at only a few degrees, and
                // at 20 they all showed as stripes down the fillets), low enough
                // to keep every real feature edge.
                const edgeGeo = new THREE.EdgesGeometry(geometry, 35);
                const edges = new THREE.LineSegments(
                    edgeGeo,
                    new THREE.LineBasicMaterial({ color: 0x2b6cb0 }),
                );
                edges.rotation.x = -Math.PI / 2;
                edges.visible = wireframe;
                scene.add(edges);
                ctx.edges = edges;

                const radius = Math.max(size.x, size.y, size.z);
                camera.position.set(radius * 1.1, radius * 1.0, radius * 1.4);
                camera.near = radius / 100;
                camera.far = radius * 50;
                camera.updateProjectionMatrix();
                controls.target.set(0, 0, 0);
                controls.update();

                setInfo({
                    tris: geometry.attributes.position.count / 3,
                    x: size.x, y: size.y, z: size.z,
                });
                setStatus(null);
            },
            undefined,
            () => {
                if (!cancelled) setStatus(`Could not load ${selected}. Has this branch been played?`);
            },
        );
        return () => { cancelled = true; };
    }, [selected, apiBase]);

    useEffect(() => {
        const ctx = sceneRef.current;
        if (!ctx) return;
        if (ctx.edges) ctx.edges.visible = wireframe;
        if (ctx.mesh) {
            // Keep the solid underneath so the part still reads as a solid,
            // just muted enough for the edges to stand out.
            ctx.mesh.material.opacity = wireframe ? 0.25 : 1;
            ctx.mesh.material.transparent = wireframe;
            ctx.mesh.material.needsUpdate = true;
        }
    }, [wireframe]);

    return (
        <div className="model-viewer">
            <div className="model-viewer-bar">
                <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    disabled={!exports.length}
                    title="Models this session exports"
                >
                    {/* Distinguish "nothing loaded" from "loaded, but it never
                        exports" -- the first message used to be shown for both,
                        which read as a bug in the export paths. */}
                    {!exports.length && (
                        <option value="">
                            {session ? 'This session has no export_model commands' : 'No session loaded'}
                        </option>
                    )}
                    {exports.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <label className="model-viewer-toggle">
                    <input
                        type="checkbox"
                        checked={wireframe}
                        onChange={(e) => setWireframe(e.target.checked)}
                    />
                    Edges
                </label>
                {info && (
                    <span className="model-viewer-info">
                        {info.x.toFixed(1)} × {info.y.toFixed(1)} × {info.z.toFixed(1)} mm
                        {' · '}{info.tris.toLocaleString()} tris
                    </span>
                )}
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelected((s) => s)}
                    title="Reload the model from disk"
                >↻</button>
            </div>
            {!exports.length && !session && (
                <p className="views-empty">Load a session to see the models it exports.</p>
            )}
            {status && <p className="views-empty">{status}</p>}
            <div className="model-viewer-canvas" ref={mountRef} />
        </div>
    );
}
