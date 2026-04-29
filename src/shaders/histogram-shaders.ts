// shared GLSL: per-splat (value, flag) computation
// flag: 0 = skip (out-of-bounds, locked, deleted, off-screen)
//       1 = unselected (state == 0)
//       2 = selected   (state == 1)
const computeValueFlagGLSL = /* glsl */ `
    uniform highp usampler2D transformA;
    uniform highp usampler2D splatTransform;
    uniform sampler2D transformPalette;
    uniform sampler2D splatState;
    uniform ivec2 splat_params;
    uniform int propMode;
    uniform mat4 entityMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 viewProjection;
    uniform int onScreenOnly;

    vec2 computeValueFlag(int idx) {
        if (idx >= splat_params.y) return vec2(0.0, 0.0);
        ivec2 uv = ivec2(idx % splat_params.x, idx / splat_params.x);

        int s = int(texelFetch(splatState, uv, 0).r * 255.0 + 0.5);
        bool sel = s == 1;
        bool clean = s == 0;
        if (!(sel || clean)) return vec2(0.0, 0.0);

        vec3 c = uintBitsToFloat(texelFetch(transformA, uv, 0).xyz);
        uint ti = texelFetch(splatTransform, uv, 0).r;
        if (ti > 0u) {
            int u = int(ti % 512u) * 3;
            int v = int(ti / 512u);
            mat3x4 t;
            t[0] = texelFetch(transformPalette, ivec2(u,     v), 0);
            t[1] = texelFetch(transformPalette, ivec2(u + 1, v), 0);
            t[2] = texelFetch(transformPalette, ivec2(u + 2, v), 0);
            c = vec4(c, 1.0) * t;
        }

        vec3 world = (entityMatrix * vec4(c, 1.0)).xyz;

        float val;
        if (propMode == 0)      val = world.x;
        else if (propMode == 1) val = world.y;
        else if (propMode == 2) val = world.z;
        else if (propMode == 3) val = length(world);
        else                    val = -(viewMatrix * vec4(world, 1.0)).z;

        if (onScreenOnly == 1) {
            vec4 clip = viewProjection * vec4(world, 1.0);
            if (clip.w <= 0.0) return vec2(0.0, 0.0);
            vec3 ndc = clip.xyz / clip.w;
            if (any(greaterThan(abs(ndc.xy), vec2(1.0))) || ndc.z < 0.0 || ndc.z > 1.0) {
                return vec2(0.0, 0.0);
            }
        }

        return vec2(val, sel ? 2.0 : 1.0);
    }
`;

const fullscreenVS = /* glsl */ `
    attribute vec2 vertex_position;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.0, 1.0);
    }
`;

// pass 1: tile min/max
// each fragment owns a contiguous range of splat indices and reduces them inline
const tileMinMaxFS = /* glsl */ `
    ${computeValueFlagGLSL}

    uniform int tileSize;
    uniform int gridDim;

    #define MAX_TILE_SIZE 65536

    void main(void) {
        ivec2 tileXY = ivec2(gl_FragCoord);
        int tileId = tileXY.y * gridDim + tileXY.x;
        int baseIdx = tileId * tileSize;
        int endIdx = min(baseIdx + tileSize, splat_params.y);

        float minVal =  1e30;
        float maxVal = -1e30;

        for (int k = 0; k < MAX_TILE_SIZE; k++) {
            int idx = baseIdx + k;
            if (idx >= endIdx) break;
            vec2 vf = computeValueFlag(idx);
            if (vf.y == 0.0) continue;
            minVal = min(minVal, vf.x);
            maxVal = max(maxVal, vf.x);
        }

        gl_FragColor = vec4(minVal, maxVal, 0.0, 0.0);
    }
`;

// pass 2: reduce 64×64 → 1×1
const finalReduceFS = /* glsl */ `
    uniform sampler2D inputTex;
    uniform int gridDim;

    #define MAX_GRID_DIM 64

    void main(void) {
        float minVal =  1e30;
        float maxVal = -1e30;

        for (int y = 0; y < MAX_GRID_DIM; y++) {
            if (y >= gridDim) break;
            for (int x = 0; x < MAX_GRID_DIM; x++) {
                if (x >= gridDim) break;
                vec2 v = texelFetch(inputTex, ivec2(x, y), 0).rg;
                minVal = min(minVal, v.x);
                maxVal = max(maxVal, v.y);
            }
        }

        gl_FragColor = vec4(minVal, maxVal, 0.0, 0.0);
    }
`;

// pass 3: bin counting (point rendering, additive blending)
const binVS = /* glsl */ `
    ${computeValueFlagGLSL}

    uniform sampler2D minMax;
    uniform int numBins;

    varying float v_flag;

    void main(void) {
        vec2 vf = computeValueFlag(gl_VertexID);
        v_flag = vf.y;

        if (vf.y == 0.0) {
            gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
            gl_PointSize = 0.0;
            return;
        }

        vec2 mm = texelFetch(minMax, ivec2(0, 0), 0).rg;
        float minV = mm.x;
        float maxV = mm.y;
        float n = (maxV == minV) ? 0.0 : (vf.x - minV) / (maxV - minV);
        int bin = clamp(int(n * float(numBins)), 0, numBins - 1);

        float xNDC = (float(bin) + 0.5) / float(numBins) * 2.0 - 1.0;
        gl_Position = vec4(xNDC, 0.0, 0.0, 1.0);
        gl_PointSize = 1.0;
    }
`;

const binFS = /* glsl */ `
    varying float v_flag;
    void main(void) {
        float sel   = v_flag == 2.0 ? 1.0 : 0.0;
        float unsel = v_flag == 1.0 ? 1.0 : 0.0;
        gl_FragColor = vec4(sel, unsel, 0.0, 0.0);
    }
`;

export {
    fullscreenVS,
    tileMinMaxFS,
    finalReduceFS,
    binVS,
    binFS
};
