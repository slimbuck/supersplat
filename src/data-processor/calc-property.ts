import {
    ADDRESS_CLAMP_TO_EDGE,
    PIXELFORMAT_RGBA32F,
    SEMANTIC_POSITION,
    drawQuadWithShader,
    GraphicsDevice,
    Mat4,
    RenderTarget,
    ScopeSpace,
    Shader,
    ShaderUtils,
    Texture,
    BlendState
} from 'playcanvas';

import { vertexShader, fragmentShader } from '../shaders/property-shader';
import { Splat } from '../splat';

const identity = new Mat4();

type CalcPropertyOptions = {
    entityMatrix?: Mat4;
    viewProjection?: Mat4;
    onScreenOnly?: boolean;
};

const resolve = (scope: ScopeSpace, values: any) => {
    for (const key in values) {
        scope.resolve(key).setValue(values[key]);
    }
};

class CalcProperty {
    private device: GraphicsDevice;
    private shader: Shader = null;
    private texture: Texture = null;
    private renderTarget: RenderTarget = null;
    private data: Float32Array = null;

    constructor(device: GraphicsDevice) {
        this.device = device;
    }

    private getResources(width: number, height: number) {
        const { device } = this;

        if (!this.shader) {
            this.shader = ShaderUtils.createShader(device, {
                uniqueName: 'calcPropertyShader',
                attributes: {
                    vertex_position: SEMANTIC_POSITION
                },
                vertexGLSL: vertexShader,
                fragmentGLSL: fragmentShader
            });
        }

        if (!this.texture || this.texture.width !== width || this.texture.height !== height) {
            if (this.texture) {
                this.texture.destroy();
                this.renderTarget.destroy();
            }

            this.texture = new Texture(device, {
                name: 'propertyTex',
                width,
                height,
                format: PIXELFORMAT_RGBA32F,
                mipmaps: false,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });

            this.renderTarget = new RenderTarget({
                colorBuffer: this.texture,
                depth: false
            });

            this.data = new Float32Array(width * height * 4);
        }

        return {
            shader: this.shader,
            texture: this.texture,
            renderTarget: this.renderTarget,
            data: this.data
        };
    }

    async run(splat: Splat, mode: number, options?: CalcPropertyOptions): Promise<Float32Array> {
        const { device } = this;
        const { scope } = device;

        const numSplats = splat.splatData.numSplats;
        const transformA = (splat.entity.gsplat.instance.resource as any).getTexture('transformA');
        const splatTransform = splat.transformTexture;
        const transformPalette = splat.transformPalette.texture;

        const resources = this.getResources(transformA.width, transformA.height);

        const entityMatrix = options?.entityMatrix ?? identity;
        const viewProjection = options?.viewProjection ?? identity;
        const onScreenOnly = options?.onScreenOnly ? 1 : 0;

        resolve(scope, {
            transformA,
            splatTransform,
            transformPalette,
            splat_params: [transformA.width, numSplats],
            propMode: mode,
            entityMatrix: entityMatrix.data,
            viewProjection: viewProjection.data,
            onScreenOnly
        });

        device.setBlendState(BlendState.NOBLEND);
        drawQuadWithShader(device, resources.renderTarget, resources.shader);

        const data = await resources.texture.read(0, 0, resources.texture.width, resources.texture.height, {
            renderTarget: resources.renderTarget,
            data: resources.data,
            immediate: false
        });

        return data as Float32Array;
    }
}

export { CalcProperty };
export type { CalcPropertyOptions };
