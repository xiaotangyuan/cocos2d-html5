/****************************************************************************
 Copyright (c) 2011-2012 cocos2d-x.org
 Copyright (c) 2013-2014 Chukong Technologies Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

(function(){
    ccui.Layout.CanvasRenderCmd = function(renderable){
        ccui.ProtectedNode.CanvasRenderCmd.call(this, renderable);
        this._needDraw = false;

        this._clipElemType = false;
        this._locCache = null;
        this._rendererSaveCmd = new cc.CustomRenderCmd(this, this._onRenderSaveCmd);
        this._rendererSaveCmdSprite = new cc.CustomRenderCmd(this, this._onRenderSaveSpriteCmd);
        this._rendererClipCmd = new cc.CustomRenderCmd(this, this._onRenderClipCmd);
        this._rendererRestoreCmd = new cc.CustomRenderCmd(this, this._onRenderRestoreCmd);
    };

    var proto = ccui.Layout.CanvasRenderCmd.prototype = Object.create(ccui.ProtectedNode.CanvasRenderCmd.prototype);
    proto.constructor = ccui.Layout.CanvasRenderCmd;

    proto._onRenderSaveCmd = function(ctx, scaleX, scaleY){
        var wrapper = ctx || cc._renderContext, context = wrapper.getContext();
        if (this._clipElemType) {
            var canvas = context.canvas;
            this._locCache = ccui.Layout.CanvasRenderCmd._getSharedCache();
            this._locCache.width = canvas.width;
            this._locCache.height = canvas.height;
            var locCacheCtx = this._locCache.getContext("2d");
            locCacheCtx.drawImage(canvas, 0, 0);
        } else {
            wrapper.save();
            wrapper.save();
            wrapper.setTransform(this._worldTransform, scaleX, scaleY);
        }
    };

    proto._onRenderSaveSpriteCmd = function(ctx){
        var wrapper = ctx || cc._renderContext;
        //var node = this._node;
        if (this._clipElemType) {
            wrapper.setCompositeOperation("destination-in");
            //var parentCmd = node._parent ? node._parent._renderCmd : null;
            //this.transform(parentCmd);                           //todo: why?
        }
    };

    proto._onRenderClipCmd = function(ctx){
        var wrapper = ctx || cc._renderContext, context = wrapper.getContext();
        if (!this._clipElemType) {
            wrapper.restore();
            context.clip();
        }
    };

    proto._onRenderRestoreCmd = function(ctx){
        var wrapper = ctx || cc._renderContext, context = wrapper.getContext();

        if (this._clipElemType) {
            // Redraw the cached canvas, so that the cliped area shows the background etc.
            context.save();
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.globalCompositeOperation = "destination-over";
            context.drawImage(this._locCache, 0, 0);
            context.restore();
        }else{
            wrapper.restore();                                  //use for restore clip operation
        }
    };

    proto.rebindStencilRendering = function(stencil){
        stencil._renderCmd.rendering = this.__stencilDraw;
    };

    proto.__stencilDraw = function(ctx,scaleX, scaleY){          //Only for Canvas
        var wrapper = ctx || cc._renderContext, locContext = wrapper.getContext(), buffer = this._buffer;

        for (var i = 0, bufLen = buffer.length; i < bufLen; i++) {
            var element = buffer[i], vertices = element.verts;
            var firstPoint = vertices[0];
            locContext.beginPath();
            locContext.moveTo(firstPoint.x * scaleX, -firstPoint.y * scaleY);
            for (var j = 1, len = vertices.length; j < len; j++)
                locContext.lineTo(vertices[j].x * scaleX, -vertices[j].y * scaleY);
            locContext.closePath();
        }
    };

    proto.stencilClippingVisit = proto.scissorClippingVisit = function(parentCmd){
        var node = this._node;
        if (!node._clippingStencil || !node._clippingStencil.isVisible())
            return;

        this._clipElemType = node._stencil instanceof cc.Sprite;
        this._syncStatus(parentCmd);
        this._dirtyFlag = 0;

        cc.renderer.pushRenderCommand(this._rendererSaveCmd);
        if (this._clipElemType) {
            cc.ProtectedNode.prototype.visit.call(node, parentCmd);
            cc.renderer.pushRenderCommand(this._rendererSaveCmdSprite);
        }
        node._clippingStencil.visit(this);

        cc.renderer.pushRenderCommand(this._rendererClipCmd);
        if (!this._clipElemType) {
            node.sortAllChildren();
            node.sortAllProtectedChildren();

            var children = node._children;
            var j, locProtectChildren = node._protectedChildren, i, locChild;
            var iLen = children.length, jLen = locProtectChildren.length;

            // draw children zOrder < 0
            for (i = 0; i < iLen; i++) {
                locChild = children[i];
                if (locChild)
                    locChild.visit(this);
            }
            for (j = 0; j < jLen; j++) {
                locChild = locProtectChildren[j];
                if (locChild)
                    locChild.visit(this);
            }
            cc.renderer.pushRenderCommand(this._rendererRestoreCmd);
        }
    };

    ccui.Layout.CanvasRenderCmd._getSharedCache = function () {
        return (cc.ClippingNode._sharedCache) || (cc.ClippingNode._sharedCache = cc.newElement("canvas"));
    };
})();