// shared GLSL chunk used by histogram and property GPU passes.
//
// declares the texture and uniform interface for reading per-splat data and
// computing a single scalar value selected by `propMode`. supports propModes:
//
//   0..2   world.x / world.y / world.z
//   3      distance (= length(world))
//   4      camera depth (= -(viewMatrix * world).z)
//   5..7   color-graded f_dc_0 / f_dc_1 / f_dc_2 channels
//   8      opacity (= splatColor.a * transparency)
//   9..11  scale_0 / scale_1 / scale_2 (exp'd in transformB.xyz)
//   12     volume (= scale.x * scale.y * scale.z)
//   13     surface area (= dot(scale, scale))
//   14..17 quat W (reconstructed, always >= 0) / X / Y / Z
//   18..20 H / S / V of the color-graded RGB
//   21..   f_rest_N (N = propMode - 21), decoded from the engine's packed SH
//          textures. only valid when SH_BANDS > 0 and N < 3 * shNumCoeffs.
//
// the active SH_BANDS define controls which SH samplers are declared and which
// branches are compiled in. callers must select a matching uniqueName so that
// each SH_BANDS variant gets its own cached shader.

const computeSplatValueGLSL = /* glsl */ `

#ifndef SH_BANDS
#define SH_BANDS 0
#endif

uniform highp usampler2D transformA;
uniform sampler2D transformB;
uniform sampler2D splatColor;
uniform highp usampler2D splatTransform;
uniform sampler2D transformPalette;
uniform sampler2D splatState;

#if SH_BANDS > 0
uniform highp usampler2D splatSH_1to3;
uniform int shNumCoeffs;
#endif
#if SH_BANDS > 1
uniform highp usampler2D splatSH_4to7;
uniform highp usampler2D splatSH_8to11;
#endif
#if SH_BANDS > 2
uniform highp usampler2D splatSH_12to15;
#endif

uniform ivec2 splat_params;
uniform int propMode;
uniform mat4 entityMatrix;
uniform mat4 viewMatrix;
uniform mat4 viewProjection;
uniform int onScreenOnly;

uniform vec3 cgScale;
uniform float cgOffset;
uniform float cgSaturation;
uniform float transparency;

vec3 applyColorGrade(vec3 c) {
    c = cgOffset + c * cgScale;
    float grey = dot(c, vec3(0.299, 0.587, 0.114));
    return mix(vec3(grey), c, cgSaturation);
}

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

#if SH_BANDS > 0
float unpackSHCoeff(int fRestIdx, ivec2 uv) {
    int channel = fRestIdx / shNumCoeffs;
    int coeffIdx = fRestIdx % shNumCoeffs;

    uvec4 sh1 = texelFetch(splatSH_1to3, uv, 0);
    float maxV = uintBitsToFloat(sh1.x);

    uint packed = 0u;
    if (coeffIdx < 3) {
        packed = sh1[coeffIdx + 1];
    }
    #if SH_BANDS > 1
    else if (coeffIdx < 7) {
        packed = texelFetch(splatSH_4to7, uv, 0)[coeffIdx - 3];
    }
    else if (coeffIdx < 11) {
        packed = texelFetch(splatSH_8to11, uv, 0)[coeffIdx - 7];
    }
    #endif
    #if SH_BANDS > 2
    else if (coeffIdx < 15) {
        packed = texelFetch(splatSH_12to15, uv, 0)[coeffIdx - 11];
    }
    #endif

    uint enc;
    float tMax;
    if (channel == 0)      { enc = (packed >> 21) & 0x7FFu; tMax = 2047.0; }
    else if (channel == 1) { enc = (packed >> 11) & 0x3FFu; tMax = 1023.0; }
    else                   { enc =  packed        & 0x7FFu; tMax = 2047.0; }

    return ((float(enc) / tMax) * 2.0 - 1.0) * maxV;
}
#endif

// computes the scalar value for the splat at the given index. returns false if
// the splat is out-of-bounds, locked, or deleted. out-params receive the
// scalar value, whether the splat is currently selected, and whether the splat
// is currently visible (always true when onScreenOnly == 0).
bool computeSplatValue(int idx, out float value, out bool selected, out bool visible) {
    value = 0.0;
    selected = false;
    visible = false;

    if (idx >= splat_params.y) return false;
    ivec2 uv = ivec2(idx % splat_params.x, idx / splat_params.x);

    int s = int(texelFetch(splatState, uv, 0).r * 255.0 + 0.5);
    selected = (s == 1);
    bool clean = (s == 0);
    if (!(selected || clean)) return false;

    uvec4 transformAData = texelFetch(transformA, uv, 0);
    vec3 pos = uintBitsToFloat(transformAData.xyz);

    uint ti = texelFetch(splatTransform, uv, 0).r;
    if (ti > 0u) {
        int u = int(ti % 512u) * 3;
        int v = int(ti / 512u);
        mat3x4 t;
        t[0] = texelFetch(transformPalette, ivec2(u,     v), 0);
        t[1] = texelFetch(transformPalette, ivec2(u + 1, v), 0);
        t[2] = texelFetch(transformPalette, ivec2(u + 2, v), 0);
        pos = vec4(pos, 1.0) * t;
    }

    vec3 world = (entityMatrix * vec4(pos, 1.0)).xyz;

    visible = true;
    if (onScreenOnly == 1) {
        vec4 clip = viewProjection * vec4(world, 1.0);
        if (clip.w <= 0.0) {
            visible = false;
        } else {
            vec3 ndc = clip.xyz / clip.w;
            if (any(greaterThan(abs(ndc.xy), vec2(1.0))) || ndc.z < 0.0 || ndc.z > 1.0) {
                visible = false;
            }
        }
    }

    if (propMode == 0)       value = world.x;
    else if (propMode == 1)  value = world.y;
    else if (propMode == 2)  value = world.z;
    else if (propMode == 3)  value = length(world);
    else if (propMode == 4)  value = -(viewMatrix * vec4(world, 1.0)).z;
    else if (propMode == 5 || propMode == 6 || propMode == 7 ||
             propMode == 18 || propMode == 19 || propMode == 20) {
        vec3 rgb = applyColorGrade(texelFetch(splatColor, uv, 0).rgb);
        if (propMode == 5)       value = rgb.r;
        else if (propMode == 6)  value = rgb.g;
        else if (propMode == 7)  value = rgb.b;
        else {
            vec3 hsv = rgb2hsv(rgb);
            if (propMode == 18)      value = hsv.x * 360.0;
            else if (propMode == 19) value = hsv.y;
            else                     value = hsv.z;
        }
    }
    else if (propMode == 8) {
        value = texelFetch(splatColor, uv, 0).a * transparency;
    }
    else if (propMode >= 9 && propMode <= 13) {
        vec3 sc = texelFetch(transformB, uv, 0).xyz;
        if (propMode == 9)       value = sc.x;
        else if (propMode == 10) value = sc.y;
        else if (propMode == 11) value = sc.z;
        else if (propMode == 12) value = sc.x * sc.y * sc.z;
        else                     value = dot(sc, sc);
    }
    else if (propMode >= 14 && propMode <= 17) {
        vec2 qxy = unpackHalf2x16(transformAData.w);
        float qz = texelFetch(transformB, uv, 0).w;
        if (propMode == 14)      value = sqrt(max(0.0, 1.0 - qxy.x * qxy.x - qxy.y * qxy.y - qz * qz));
        else if (propMode == 15) value = qxy.x;
        else if (propMode == 16) value = qxy.y;
        else                     value = qz;
    }
    #if SH_BANDS > 0
    else if (propMode >= 21) {
        value = unpackSHCoeff(propMode - 21, uv);
    }
    #endif

    return true;
}
`;

export { computeSplatValueGLSL };
