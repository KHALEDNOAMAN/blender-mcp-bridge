// Ported from app.js newSessionBtn handler — exact same command payloads
// (minus created_at/timestamp, removed as unused metadata — see docs/studio_design_v1.md).

export function buildSessionFromTemplate(template) {
    if (template === '3d_print') {
        return {
            metadata: {
                name: '3D Printing Session',
                model: '',
                description: '3D printing workflow in millimeters.'
            },
            commands: [
                {
                    tool: 'set_scene_units',
                    arguments: {
                        system: 'METRIC',
                        length_unit: 'MILLIMETERS',
                        scale: 0.001
                    },
                    description: 'Configure scene units to millimeters and set unit scale to 0.001 (divide by 1000).'
                }
            ]
        };
    }

    if (template === 'stl_edit') {
        return {
            metadata: {
                name: 'STL Edit Session',
                model: '',
                description: 'Import STL and prepare for editing.'
            },
            commands: [
                {
                    tool: 'set_scene_units',
                    arguments: {
                        system: 'METRIC',
                        length_unit: 'MILLIMETERS',
                        scale: 0.001
                    },
                    description: 'Configure scene units to millimeters and set unit scale to 0.001 (divide by 1000).'
                },
                {
                    tool: 'import_model',
                    arguments: {
                        filepath: 'assets/3DBenchy.stl'
                    },
                    description: 'Import the base STL model to modify.'
                }
            ]
        };
    }

    // blank
    return {
        metadata: {
            name: 'New Blank Session',
            model: '',
            description: 'A new session started from scratch.'
        },
        commands: []
    };
}
