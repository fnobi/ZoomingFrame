// init
var zoomingFrame = new ZoomingFrame({
    $root: $('.wrapper'),      // root element
    max: 10000,                // scroll end value
    $touchMat: $('.touch-mat') // element for sp touch event
});

// add figure
zoomingFrame.addFigure($('.sample-figure'), [{
    scroll: 0,
    scale: 1
}, {
    scroll: 2000,
    scale: 2
}], { after: 'fit' });
