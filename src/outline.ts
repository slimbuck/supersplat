import {
    CULLFACE_NONE,
    SEMANTIC_POSITION,
    createShaderFromCode,
    BlendState,
    DepthState,
    Color,
    Entity,
    RenderPass,
    Shader,
    QuadRender,
    GraphicsDevice,
    Vec4
} from 'playcanvas';

import { Element, ElementType } from './element';
import { vertexShader, fragmentShader } from './shaders/outline-shader';

class QuadRenderPass extends RenderPass {
    quad: QuadRender;

    constructor(device: GraphicsDevice, shader: Shader) {
        super(device);

        this.quad = new QuadRender(shader);
    }

    execute(rect?: Vec4, scissor?: Vec4) {
        const { device } = this;
        device.setCullMode(CULLFACE_NONE);
        device.setDepthState(DepthState.NODEPTH);
        device.setStencilState(null, null);
        this.quad.render(rect, scissor);
    }
}

class Outline extends Element {
    entity: Entity;
    shader: Shader;
    renderPass: RenderPass;
    enabled = true;
    clr = new Color(1, 1, 1, 0.5);

    constructor() {
        super(ElementType.other);

        this.entity = new Entity('outlineCamera');
        this.entity.addComponent('camera');
        this.entity.camera.setShaderPass('OUTLINE');
        this.entity.camera.clearColor = new Color(0, 0, 0, 0);
    }

    add() {
        const device = this.scene.app.graphicsDevice;
        const layerId = this.scene.overlayLayer.id;

        // render overlay layer only
        this.entity.camera.layers = [layerId];
        this.scene.camera.entity.addChild(this.entity);

        this.shader = createShaderFromCode(device, vertexShader, fragmentShader, 'apply-outline', {
            vertex_position: SEMANTIC_POSITION
        });

        const outlineTextureId = device.scope.resolve('outlineTexture');
        const alphaCutoffId = device.scope.resolve('alphaCutoff');
        const clrId = device.scope.resolve('clr');
        const clrStorage = [1, 1, 1, 1];
        const events = this.scene.events;

        // apply the outline texture to the display before gizmos render
        this.onPostRender = () => {
            if (!this.entity.enabled) {
                return;
            }

            if (!this.renderPass) {
                this.renderPass = new QuadRenderPass(this.scene.graphicsDevice, this.shader);
                this.renderPass.init(this.scene.camera.entity.camera.renderTarget);
                this.renderPass.colorOps.clear = false;
                this.renderPass.depthStencilOps.clearDepth = false;
            }

            device.setBlendState(BlendState.ALPHABLEND);

            const selectedClr = events.invoke('selectedClr');
            clrStorage[0] = selectedClr.r;
            clrStorage[1] = selectedClr.g;
            clrStorage[2] = selectedClr.b;
            clrStorage[3] = selectedClr.a;

            outlineTextureId.setValue(this.entity.camera.renderTarget.colorBuffer);
            alphaCutoffId.setValue(events.invoke('camera.mode') === 'rings' ? 0.0 : 0.4);
            clrId.setValue(clrStorage);

            this.renderPass.render();
        };
    }

    remove() {
        this.scene.camera.entity.removeChild(this.entity);
    }

    onPreRender() {
        // copy camera properties
        const src = this.scene.camera.entity.camera;
        const dst = this.entity.camera;

        dst.projection = src.projection;
        dst.horizontalFov = src.horizontalFov;
        dst.fov = src.fov;
        dst.nearClip = src.nearClip;
        dst.farClip = src.farClip;
        dst.orthoHeight = src.orthoHeight;

        this.entity.enabled = this.enabled && this.scene.events.invoke('view.outlineSelection');
        this.entity.camera.renderTarget = this.scene.camera.workRenderTarget;
    }
}

export { Outline };
