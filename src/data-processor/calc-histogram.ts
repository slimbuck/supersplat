import {
    ADDRESS_CLAMP_TO_EDGE,
    BLENDEQUATION_ADD,
    BLENDMODE_ONE,
    PIXELFORMAT_RGBA32F,
    SEMANTIC_POSITION,
    drawQuadWithShader,
    BlendState,
    GraphicsDevice,
    Mat4,
    RenderTarget,
    ScopeSpace,
    Shader,
    ShaderUtils,
    Texture
} from 'playcanvas';

import { drawPointsWithShader } from './draw-points';
import {
    fullscreenVS,
    tileMinMaxFS,
    finalReduceFS,
    binVS,
    binFS
} from '../shaders/histogram-shaders';
import { Splat } from '../splat';

const GRID_DIM = 64;
const NUM_BINS = 256;

const identity = new Mat4();

type CalcHistogramOptions = {
    entityMatrix?: Mat4;
    viewMatrix?: Mat4;
    viewProjection?: Mat4;
    onScreenOnly?: boolean;
    numBins?: number;
};

type CalcHistogramResult = {
    selected: Float32Array;     // length numBins
    unselected: Float32Array;   // length numBins
    min: number;
    max: number;
    numValues: number;
};

const resolve = (scope: ScopeSpace, values: any) => {
    for (const key in values) {
        scope.resolve(key).setValue(values[key]);
    }
};

class CalcHistogram {
    private device: GraphicsDevice;

    private tileShader: Shader = null;
    private reduceShader: Shader = null;
    private binShaderRef: Shader = null;

    private tileTex: Texture = null;
    private tileRT: RenderTarget = null;
    private minMaxTex: Texture = null;
    private minMaxRT: RenderTarget = null;
    private binTex: Texture = null;
    private binRT: RenderTarget = null;

    private tileData = new Float32Array(GRID_DIM * GRID_DIM * 4);
    private minMaxData = new Float32Array(4);
    private binData = new Float32Array(NUM_BINS * 4);

    private additiveBlend: BlendState;

    constructor(device: GraphicsDevice) {
        this.device = device;

        this.additiveBlend = new BlendState(
            true,
            BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE,
            BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE
        );
    }

    private ensureResources() {
        const { device } = this;

        if (!this.tileShader) {
            this.tileShader = ShaderUtils.createShader(device, {
                uniqueName: 'histTileMinMax',
                attributes: { vertex_position: SEMANTIC_POSITION },
                vertexGLSL: fullscreenVS,
                fragmentGLSL: tileMinMaxFS
            });
            this.reduceShader = ShaderUtils.createShader(device, {
                uniqueName: 'histFinalReduce',
                attributes: { vertex_position: SEMANTIC_POSITION },
                vertexGLSL: fullscreenVS,
                fragmentGLSL: finalReduceFS
            });
            this.binShaderRef = ShaderUtils.createShader(device, {
                uniqueName: 'histBin',
                attributes: { vertex_position: SEMANTIC_POSITION },
                vertexGLSL: binVS,
                fragmentGLSL: binFS
            });
        }

        if (!this.tileTex) {
            this.tileTex = new Texture(device, {
                name: 'histTile',
                width: GRID_DIM,
                height: GRID_DIM,
                format: PIXELFORMAT_RGBA32F,
                mipmaps: false,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });
            this.tileRT = new RenderTarget({ colorBuffer: this.tileTex, depth: false });

            this.minMaxTex = new Texture(device, {
                name: 'histMinMax',
                width: 1,
                height: 1,
                format: PIXELFORMAT_RGBA32F,
                mipmaps: false,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });
            this.minMaxRT = new RenderTarget({ colorBuffer: this.minMaxTex, depth: false });

            this.binTex = new Texture(device, {
                name: 'histBins',
                width: NUM_BINS,
                height: 1,
                format: PIXELFORMAT_RGBA32F,
                mipmaps: false,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });
            this.binRT = new RenderTarget({ colorBuffer: this.binTex, depth: false });
        }
    }

    private setSplatUniforms(splat: Splat, mode: number, options?: CalcHistogramOptions) {
        const { scope } = this.device;
        const numSplats = splat.splatData.numSplats;
        const transformA = (splat.entity.gsplat.instance.resource as any).getTexture('transformA');
        const splatTransform = splat.transformTexture;
        const transformPalette = splat.transformPalette.texture;
        const splatState = splat.stateTexture;

        const entityMatrix = options?.entityMatrix ?? identity;
        const viewMatrix = options?.viewMatrix ?? identity;
        const viewProjection = options?.viewProjection ?? identity;
        const onScreenOnly = options?.onScreenOnly ? 1 : 0;

        resolve(scope, {
            transformA,
            splatTransform,
            transformPalette,
            splatState,
            splat_params: [transformA.width, numSplats],
            propMode: mode,
            entityMatrix: entityMatrix.data,
            viewMatrix: viewMatrix.data,
            viewProjection: viewProjection.data,
            onScreenOnly
        });

        return numSplats;
    }

    private clearRT(rt: RenderTarget) {
        const d = this.device as any;
        const oldRt = d.renderTarget;
        const oldVx = d.vx, oldVy = d.vy, oldVw = d.vw, oldVh = d.vh;
        const oldSx = d.sx, oldSy = d.sy, oldSw = d.sw, oldSh = d.sh;

        d.setRenderTarget(rt);
        d.updateBegin();
        d.setViewport(0, 0, rt.width, rt.height);
        d.setScissor(0, 0, rt.width, rt.height);
        d.clear({ color: [0, 0, 0, 0], flags: 1 });
        d.updateEnd();

        d.setRenderTarget(oldRt);
        d.setViewport(oldVx, oldVy, oldVw, oldVh);
        d.setScissor(oldSx, oldSy, oldSw, oldSh);
    }

    async run(splat: Splat, mode: number, options?: CalcHistogramOptions): Promise<CalcHistogramResult> {
        this.ensureResources();
        const { device } = this;
        const { scope } = device;

        const numSplats = this.setSplatUniforms(splat, mode, options);
        const numBins = options?.numBins ?? NUM_BINS;

        const tileSize = Math.ceil(numSplats / (GRID_DIM * GRID_DIM));
        scope.resolve('tileSize').setValue(tileSize);
        scope.resolve('gridDim').setValue(GRID_DIM);

        // pass 1: tile min/max (fullscreen quad over GRID_DIM x GRID_DIM)
        device.setBlendState(BlendState.NOBLEND);
        drawQuadWithShader(device, this.tileRT, this.tileShader);

        // pass 2: final reduce 64x64 → 1x1
        scope.resolve('inputTex').setValue(this.tileTex);
        scope.resolve('gridDim').setValue(GRID_DIM);
        device.setBlendState(BlendState.NOBLEND);
        drawQuadWithShader(device, this.minMaxRT, this.reduceShader);

        // pass 3: clear bins, then additive-blend point dispatch
        this.clearRT(this.binRT);

        // bin shader needs same splat uniforms + minMax + numBins
        this.setSplatUniforms(splat, mode, options);
        scope.resolve('minMax').setValue(this.minMaxTex);
        scope.resolve('numBins').setValue(numBins);

        drawPointsWithShader(device, this.binRT, this.binShaderRef, numSplats, this.additiveBlend);

        // readback minMax (8 bytes) and bins (4 KB)
        await this.minMaxTex.read(0, 0, 1, 1, {
            renderTarget: this.minMaxRT,
            data: this.minMaxData,
            immediate: false
        });

        await this.binTex.read(0, 0, NUM_BINS, 1, {
            renderTarget: this.binRT,
            data: this.binData,
            immediate: false
        });

        let min = this.minMaxData[0];
        let max = this.minMaxData[1];

        // detect "nothing contributed" (sentinel survives reduction)
        if (min > max) {
            min = 0;
            max = 0;
        }

        const selected = new Float32Array(numBins);
        const unselected = new Float32Array(numBins);
        let numValues = 0;
        for (let i = 0; i < numBins; i++) {
            const s = this.binData[i * 4];
            const u = this.binData[i * 4 + 1];
            selected[i] = s;
            unselected[i] = u;
            numValues += s + u;
        }

        return { selected, unselected, min, max, numValues };
    }
}

export { CalcHistogram };
export type { CalcHistogramOptions, CalcHistogramResult };
