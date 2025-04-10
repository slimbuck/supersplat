import {
    BLENDEQUATION_ADD,
    BLENDMODE_ONE,
    BLENDMODE_ZERO,
    CULLFACE_NONE,
    SEMANTIC_POSITION,
    createShaderFromCode,
    BlendState,
    Color,
    DepthState,
    Entity,
    GraphicsDevice,
    RenderPass,
    Shader,
    QuadRender,
    Vec4
} from 'playcanvas';

import { Element, ElementType } from './element';
import { vertexShader, fragmentShader } from './shaders/blit-shader';

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

class Underlay extends Element {
    entity: Entity;
    shader: Shader;
    renderPass: RenderPass;
    enabled = true;

    constructor() {
        super(ElementType.other);

        this.entity = new Entity('underlayCamera');
        this.entity.addComponent('camera');
        this.entity.camera.setShaderPass('UNDERLAY');
        this.entity.camera.clearColor = new Color(0, 0, 0, 0);
    }

    add() {
        const device = this.scene.app.graphicsDevice;
        const layerId = this.scene.overlayLayer.id;

        this.entity.camera.layers = [layerId];
        this.scene.camera.entity.addChild(this.entity);

        this.shader = createShaderFromCode(device, vertexShader, fragmentShader, 'apply-underlay', {
            vertex_position: SEMANTIC_POSITION
        });

        const blendState = new BlendState(true,
            BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE,
            BLENDEQUATION_ADD, BLENDMODE_ZERO, BLENDMODE_ONE
        );

        const blitTextureId = device.scope.resolve('blitTexture');

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
    
            device.setBlendState(blendState);
    
            blitTextureId.setValue(this.entity.camera.renderTarget.colorBuffer);
    
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

        this.entity.enabled = this.enabled && !this.scene.events.invoke('view.outlineSelection');
        this.entity.camera.renderTarget = this.scene.camera.workRenderTarget;
    }
}

export { Underlay };
