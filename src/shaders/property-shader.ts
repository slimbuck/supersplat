const vertexShader = /* glsl */ `
    attribute vec2 vertex_position;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.0, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform highp usampler2D transformA;            // splat center x, y, z
    uniform highp usampler2D splatTransform;        // transform palette index
    uniform sampler2D transformPalette;             // palette of transforms
    uniform ivec2 splat_params;                     // splat texture width, num splats
    uniform int propMode;                           // 0=x, 1=y, 2=z, 3=distance, 4=camera depth
    uniform mat4 entityMatrix;                      // splat entity world transform
    uniform mat4 viewMatrix;                        // camera view matrix (only when propMode==4)
    uniform mat4 viewProjection;                    // camera view*projection (only when onScreenOnly==1)
    uniform int onScreenOnly;                       // 1 = mark off-screen splats with visibility=0

    void main(void) {
        ivec2 splatUV = ivec2(gl_FragCoord);

        if (splatUV.x + splatUV.y * splat_params.x >= splat_params.y) {
            discard;
        }

        vec3 center = uintBitsToFloat(texelFetch(transformA, splatUV, 0).xyz);

        uint transformIndex = texelFetch(splatTransform, splatUV, 0).r;
        if (transformIndex > 0u) {
            int u = int(transformIndex % 512u) * 3;
            int v = int(transformIndex / 512u);

            mat3x4 t;
            t[0] = texelFetch(transformPalette, ivec2(u, v), 0);
            t[1] = texelFetch(transformPalette, ivec2(u + 1, v), 0);
            t[2] = texelFetch(transformPalette, ivec2(u + 2, v), 0);

            center = vec4(center, 1.0) * t;
        }

        vec3 worldCenter = (entityMatrix * vec4(center, 1.0)).xyz;

        float value = 0.0;
        if (propMode == 0)      value = worldCenter.x;
        else if (propMode == 1) value = worldCenter.y;
        else if (propMode == 2) value = worldCenter.z;
        else if (propMode == 3) value = length(worldCenter);
        else if (propMode == 4) value = -(viewMatrix * vec4(worldCenter, 1.0)).z;

        float visibility = 1.0;
        if (onScreenOnly == 1) {
            vec4 clip = viewProjection * vec4(worldCenter, 1.0);
            if (clip.w <= 0.0) {
                visibility = 0.0;
            } else {
                vec3 ndc = clip.xyz / clip.w;
                if (ndc.x < -1.0 || ndc.x > 1.0 ||
                    ndc.y < -1.0 || ndc.y > 1.0 ||
                    ndc.z <  0.0 || ndc.z > 1.0) {
                    visibility = 0.0;
                }
            }
        }

        gl_FragColor = vec4(value, visibility, 0.0, 0.0);
    }
`;

export { vertexShader, fragmentShader };
