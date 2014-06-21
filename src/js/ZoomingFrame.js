(function (exports) {
    var isFirefox = (navigator.userAgent.toLowerCase().indexOf('firefox') != -1);

    var ZoomingFrame = function (opts) {
        opts = opts || {};

        this.$root = opts.$root;
        this.$content = opts.$content || $('<div />');
        this.$touchMat = opts.$touchMat || $('<div />');
        this.max = opts.max;

        this.offset = 0;
        this.isLocked = false;
        this.isAutoScrolling = false;

        this.onGoal = false;

        this.initListeners();
    }
    inherits(ZoomingFrame, EventEmitter);

    ZoomingFrame.prototype.initListeners = function () {
        var self = this;

        this.$root.on('wheel mousewheel DOMMouseScroll', function (e) {
            self.handleScrollEvent(e);
        });

        var prevX, prevY;
        var $touchMat = this.$touchMat;
        var isTap = false;

        $touchMat.on('touchstart', function (e) {
            e.preventDefault();
            isTap = true;
            var touch = e.originalEvent.touches[0];
            prevX = touch.pageX;
            prevY = touch.pageY;
        });

        $touchMat.on('touchmove', function (e) {
            e.preventDefault();
            isTap = false;

            if (self.isLocked || self.isAutoScrolling) {
                return;
            }

            var touch = e.originalEvent.touches[0];
            var deltaX = touch.pageX - prevX;
            var deltaY = touch.pageY - prevY;
            var value = (deltaX - deltaY) * 5;

            var offset = self.offset + value;
            offset = Math.max(offset, 0);
            if (!isNaN(self.max)) {
                offset = Math.min(offset, self.max);
            }
            self.setOffset(offset);

            prevX = touch.pageX;
            prevY = touch.pageY;
        });

        $touchMat.on('touchend', function (e) {
            e.preventDefault();
            if (isTap) {
                $touchMat.trigger('click');
            }
        });
    };

    ZoomingFrame.prototype.handleScrollEvent = function (e) {
        if (!isFirefox) {
            // firefoxでは、preventDefaultするとスクロール値がとれなくなる
            e.preventDefault();
        }

        if (this.isLocked || this.isAutoScrolling) {
            return;
        }

        var value = 0;
        if (e.originalEvent.wheelDelta) {
            value = -e.originalEvent.wheelDelta;
        } else if (e.originalEvent.detail) {
            value = e.originalEvent.detail * 10;
        }

        var offset = this.offset + value;
        offset = Math.max(offset, 0);
        if (!isNaN(this.max)) {
            offset = Math.min(offset, this.max);
        }
        this.setOffset(offset);
    };

    ZoomingFrame.prototype.setOffset = function (offset) {
        this.offset = offset;
        this.$content.css('marginTop', -offset + 'px');
        this.emit('scroll', offset);

        var max = this.max;
        if (!this.onGoal && offset == max) {
            this.onGoal = true;
            this.emit('arriveGoal');
        } else if (this.onGoal && offset != max) {
            this.onGoal = false;
            this.emit('leaveGoal');
        }
    };

    ZoomingFrame.prototype.addFigure = function ($el, map, opts) {
        var figure = new Figure($el, map, opts);
        
        this.on('scroll', function (scroll) {
            figure.update(scroll);
        });
        figure.update(0);

        return figure;
    };

    ZoomingFrame.prototype.jumpTo = function (to, duration, callback) {
        to = to || 0;
        duration = duration || 0;
        callback = callback || function () {};

        if (this.isAutoScrolling) {
            return;
        }

        var self = this;

        if (duration == 0) {
            setTimeout(function () {
                self.setOffset(to);
            });
            return;
        }

        var clock = 50;
        var step = Math.floor(duration / clock);
        var unit = (to - this.offset) / step;

        var count = 0;

        this.isAutoScrolling = true;

        var loop = setInterval(function () {
            if (count >= step) {
                self.setOffset(to);
                clearInterval(loop);
                self.isAutoScrolling = false;
                return callback();
            }

            var distance = to - self.offset;
            self.setOffset(self.offset + distance / (step - count));
            count++;
        }, clock);
    };

    ZoomingFrame.prototype.lock = function () {
        this.isLocked = true;
    };

    ZoomingFrame.prototype.unlock = function () {
        this.isLocked = false;
    };


    function Figure ($el, map, opts) {
        opts = opts || {};

        this.$el = $el;
        this.map = map;

        this.after = opts.after || 'hide';

        this.easing = function (t) {
            return Math.pow(t, 4);
        };

        this.initEl();
    }

    Figure.prototype.initEl = function () {
        this.$el.css('position', 'absolute');
    };

    Figure.prototype.update = function (s) {
        var self = this;

        var $el = this.$el;
        var map = this.map;
        var easing = this.easing;

        var first = 0;
        var last = map.length - 1;

        var after = this.after;

        if (s < map[first].scroll) {
            $el.hide();
            return;
        } else if (map[last].scroll < s) {
            if (after == 'fit') {
                this.applyCSS(map[last]);
            } else if (after == 'hide') {
                $el.hide();
            }
            return;
        } else {
            $el.show();
        }

        if (s == map[0].scroll) {
            this.applyCSS(map[0]);
            return;
        }

        var prev = null;
        $.each(map, function (index, opt) {
            if (!prev) {
                prev = opt;
                return;
            }

            if (prev.scroll < s && s <= opt.scroll) {
                var v = easing((s - prev.scroll) / (opt.scroll - prev.scroll));

                self.applyCSS({
                    x: util.fade(prev.x, opt.x, v),
                    y: util.fade(prev.y, opt.y, v),
                    opacity: util.fade(prev.opacity, opt.opacity, v),
                    r: util.fade(prev.r, opt.r, v),
                    scale: util.fade(prev.scale, opt.scale, v)
                });
            }

            prev = opt;
        });
    };

    Figure.prototype.applyCSS = function (opts) {
        var $el = this.$el;

        var x = opts.x;
        var y = opts.y;
        var opacity = opts.opacity;
        var r = opts.r;
        var scale = opts.scale;

        var transforms = [];
        if (!isNaN(r)) {
            transforms.push('rotate(' + r + 'deg)');
        }
        if (!isNaN(scale)) {
            transforms.push('scale(' + scale + ')');
        }
        var transform = transforms.join(' ');

        var css = {};
        if (!isNaN(x)) {
            css.left = x + '%';
        }
        if (!isNaN(y)) {
            css.top = y + '%';
        }
        if (transform) {
            css.transform = transform;
            css.webkitTransform = transform;
        }
        if (!isNaN(opacity)) {
            css.opacity = opacity;
        }

        $el.css(css);
    };

    var util = {
        fade: function (from, to, v, def) {
            from = isNaN(from) ? def : from;
            to = isNaN(to) ? def : to;
            return from + (to - from) * v;
        }
    };

    exports.ZoomingFrame = ZoomingFrame;
})(window);
