 $(function () {
    var video = document.querySelector('#video'),
        canvas = document.querySelector('#canvas'),
        outcanvas = document.querySelector('#out'),
        msg = document.querySelector('#msg'),
        startmsg = document.querySelector('#startmsg'),
        controls = document.querySelector('#controls'),
        context  = canvas.getContext('2d'),
        outcontext = outcanvas.getContext('2d'),

        sampling = 1, // only consider every Nth pixel

        // length of block sides
        blocksize = 1,

        width = 320,
        height,

        snapshot_every = 500,
        max_snapshots = 100,
        MIN_SNAPSHOT_DISTANCE = 100, //(2 * 2) + (2 * 2) + (2 * 2),
        last_frame = NaN,
        last_snapshot,

        out_scale = 10,

        min_frame_time = 50,

        tree = new kdTree([], distance, ['l', 'a', 'b']),
        tree_memoization = {},
        queue = new PQueue(),

        nearest_search_duration,

        SNAPSHOT_CONFIDENCE = 20,

        MAX_DISTANCE_TO_RENDER_SNAPSHOT = 30,

        OUTLINE_DRAWN_SNAPSHOTS = false,

        BLURRY = 'blurry',
        PHOTOS = 'photos',
        PAUSE  = 'pause',
        config = {
            type: PHOTOS,
            render_confidence : 10
        },
        canvases = { },
        pixel_buffer,
        initial_squares = [],
        initial_square_length = 32; //width / 10 / 2; // 16

    video.addEventListener('canplay', _.once(function () {
        // setTimeout because firefox doesn't give me the videoHeight/videoWidth paramters right away
        setTimeout(function () {
            startmsg.style.display = 'none';
            height = video.videoHeight / (video.videoWidth/width);
            video.setAttribute('width', width);
            video.setAttribute('height', height);
            canvas.setAttribute('width', width);
            canvas.setAttribute('height', height);

            (function() {
                for (y = 0; y < height; y += initial_square_length) {
                    for (x = 0; x < width; x += initial_square_length) {
                        initial_squares.push(new Rect(x, y, initial_square_length, initial_square_length, false));
                    }
                }
            })();


            $(controls)
            .show()
            .append($('<span data-type="' + PHOTOS + '">photos</span>'))
            .append($('<span data-type="' + BLURRY + '">blurry</span>'))
            .append($('<span data-type="' + PAUSE  + '">pause</span>'))
            .find('[data-type]').click(function () {
                var type = $(this).attr('data-type');
                config.type = type;
                $('body').removeClass().addClass(config.type);
            });

            $('<span>threshold: -<input type="range" name="confidence" min="1" max="50">+</span>')
            .appendTo(controls)
            .find('input')
            .val(config.render_confidence)
            .change(function () {
                config.render_confidence = $(this).val();
                console.log('changing confidence to: ' + config.render_confidence);
            });

            $('#debug').click(function (){
                $(this).toggleClass('open');
            });

            $('body').removeClass().addClass(config.type);

            // pretend "last snapshot" just happened so that we'll delay until
            // the webcam actually boots up
            last_snapshot = +new Date();
            setInterval(renderFrame, min_frame_time);
        }, 500);

    }));

    video.style.display = 'none';

    navigator.getMedia = ( navigator.getUserMedia ||
                             navigator.webkitGetUserMedia ||
                             navigator.mozGetUserMedia ||
                             navigator.msGetUserMedia);

    navigator.getMedia(
        {
            video : true,
            audio : false
        },
        function (stream) {
            if (navigator.mozGetUserMedia) {
                video.mozSrcObject = stream;
            } else if (navigator.getUserMedia) {
                video.src = stream;
            } else {
                video.src = (window.URL || window.webkitURL).createObjectURL(stream);
            }
            video.play();
        },
        function (err) {
            console.error('could not connect to video stream: ' + err);
        });

    function pixelate(pixel_buffer, to_context) {
        var color,
            nearest_node,
            nearest_start,
            nearest_end,
            rectangles = pixel_buffer.segmentIntoConsistentlyColoredRectangles({
                    min_length: blocksize,
                    required_confidence : config.render_confidence,
                    include_unconfident : true,
                    rectangles : initial_squares.slice(),
                    scale_confidence : false
                }),
            draw = function (rect, color, image) {
                var x = (width - rect.x - rect.w) * out_scale,
                    y = rect.y * out_scale,
                    w = rect.w * out_scale,
                    h = rect.h * out_scale;
                if (image) {
                    to_context.drawImage(image, x, y, w, h);
                    if (OUTLINE_DRAWN_SNAPSHOTS) {
                        to_context.strokeStyle='#ff0000';
                        to_context.lineWidth=1;
                        to_context.strokeRect(x, y, w, h);
                    }
                } else {
                    to_context.fillStyle = rgb_to_hex(lab_to_rgb(color[0], color[1], color[2]));
                    to_context.fillRect(x, y, w, h);
                }
            };

        nearest_search_duration = 0;

        rectangles.forEach(function (rect_color_tuple) {
            var rect = rect_color_tuple[0],
                color_and_confidence = rect_color_tuple[1],
                color = color_and_confidence.color;
            if (rect.w <= 2 || config.type === BLURRY) {
                draw(rect, color);
            } else {
                nearest_start = performance.now();
                nearest_node = tree.nearest({
                        l: color[0],
                        a: color[1],
                        b: color[2]
                    }, 1)
                nearest_end = performance.now();
                nearest_search_duration += (nearest_end - nearest_start);

                if (nearest_node.length !== 1) {
                    console.error('Expected one snapshot, but got ' + nearest_node.length);
                } else {
                    if (nearest_node[0][1] > MAX_DISTANCE_TO_RENDER_SNAPSHOT) {
                        draw(rect, color);
                    } else {
                        draw(rect, color, nearest_node[0][0].i);
                    }
                }
            }

        });
    }

    function find_snapshot(r, g, b) {
        /*
        var key = r + g + b
        tree_memoization 
        */
    }

    function toHex(value) {
        var str = '00' + value.toString(16);
        return str.substring(str.length-2);
    }

    function distance(a, b) {
        var dist = Math.pow(a.l - b.l, 2) +
               Math.pow(a.a - b.a, 2) +
               Math.pow(a.b - b.b, 2);
        return dist;
    }

    function takeSnapshot(canvas, pixel_buffer) {
        var rectangles = pixel_buffer.segmentIntoConsistentlyColoredRectangles({
                min_length          : height/4,
                include_unconfident : false,
                required_confidence : SNAPSHOT_CONFIDENCE,
                rectangles          : [ new Rect(40, 0, height, height, true) ]
            });
        rectangles.forEach(function (rectColorTuple) {
            var rect = rectColorTuple[0],
                color_and_confidence = rectColorTuple[1],
                color = color_and_confidence.color,
                confidence = color_and_confidence.confidence,
                image = new Image(),
                square_canvas,
                square_canvas_context,
                snapshot = {
                    'l' : color[0], 
                    'a' : color[1],
                    'b' : color[2],
                    'c' : confidence
                },
                nearest_result,
                nearest_obj;

            if (queue.getLength() > 0) {
                nearest_result = tree.nearest(snapshot, 1);

                // don't save snapshots that are too similar to ones we've already got
                if (nearest_result.length > 0) {
                    nearest_result = nearest_result[0];
                    nearest_obj = nearest_result[0];
                    if (nearest_result[1] < MIN_SNAPSHOT_DISTANCE) {
                        //console.log('there is a competing snapshot, confidence: ' + confidence);
                        if (nearest_obj.c < confidence) {
                            console.log('found a new snapshot with better confidence');
                            tree.remove(nearest_obj);
                            queue.remove(nearest_obj);
                        } else {
                            return;
                        }
                    } else {
                        //console.log('new snapshot is far enough away: ' + nearest_result[1]);
                    }
                }
            }

            canvas_and_context = getSquareCanvasAndContext(rect.w);
            square_canvas = canvas_and_context[0];
            square_context = canvas_and_context[1];

            // flip images horizontally
            square_context.translate(rect.w, 0);
            square_context.scale(-1, 1);

            square_context.drawImage(canvas, -rect.x, -rect.y);
            image.src = square_canvas.toDataURL("image/png");
            snapshot.i = image;
            tree.insert(snapshot);
            queue.enqueue(snapshot);

            fillDebug();

        });

        while (queue.getLength() > max_snapshots) {
            to_remove = queue.dequeue();
            tree.remove(to_remove);
        }

    }

    function fillDebug() {
        var $ul = $('#debug ul');
        $ul.empty();
        queue.each(function (item) {
            $('<li>')
            .append(
                $('<img>').attr('src', item.i.src)
            )
            .append(
                $('<span class="swatch"></span>')
                .css('background-color', rgb_to_hex(lab_to_rgb(item.l, item.a, item.b)))
            )
            .appendTo($ul);
        });
    }


    function renderFrame() {
        var now = +new Date(),
            time_since_last_frame = now - last_frame,
            time_since_last_snapshot = now - last_snapshot,
            color,
            image;
            //pixel_buffer;
        if (config.type === PAUSE) {
            return;
        }
        last_frame = now;
        canvas.width = width;
        canvas.height = height;
        outcanvas.width = width * out_scale;
        outcanvas.height = height * out_scale;
        context.drawImage(video, 0, 0, width, height);

        image_data = context.getImageData(0, 0, width, height);
        pixel_buffer = new PixelBuffer(image_data, width, height);

        if (isNaN(time_since_last_snapshot) || time_since_last_snapshot > snapshot_every) {
            last_snapshot = now;
            takeSnapshot(canvas, pixel_buffer);
        }

        // wait until at least one snapshot has been taken
        if (queue.getLength() > 0) {
            pixelate(pixel_buffer, outcontext);
        }
        if (! isNaN(time_since_last_frame) ) {
            msg.innerHTML = 'saved snapshots: ' + queue.getLength() + '/' + max_snapshots +
                            ', total snapshot search time: ' + Math.floor(nearest_search_duration) + 'ms' +
                            ', frame render time: ' + Math.floor(time_since_last_frame) + 'ms';
        }
    }


    // returns a square canvas
    // performs memoization, so the same canvas will be reused on subsequent calls
    // if you need a clean canvas, make sure to clear it before using it
    function getSquareCanvasAndContext(length) {
        if (length in canvases) {
            return canvases[length];
        }
        var canvas = document.createElement('canvas'),
            context;
        canvas.width = length;
        canvas.height = length;
        context = canvas.getContext('2d');
        canvases[length] = [canvas, context];
        return canvases[length];
    }



    function Rect(x, y, w, h, can_overlap) {
        this.x = ~~x;
        this.y = ~~y;
        this.w = ~~(w+.5);
        this.h = ~~(h+.5);
        this.can_overlap = can_overlap;
    }
    Rect.prototype = {
        divide : function () {
            var new_w = this.w / 2,
                new_h = this.h / 2,
                new_rects = [];
            if (this.can_overlap) {
                new_rects.push(new Rect(this.x+(new_w/2), this.y+(new_h/2), new_w, new_h, this.can_overlap));
            }
            new_rects.push(new Rect(this.x,       this.y,       new_w, new_h, this.can_overlap));
            new_rects.push(new Rect(this.x+new_w, this.y,       new_w, new_h, this.can_overlap));
            new_rects.push(new Rect(this.x,       this.y+new_h, new_w, new_h, this.can_overlap));
            new_rects.push(new Rect(this.x+new_w, this.y+new_h, new_w, new_h, this.can_overlap));
            //    ];//[ ~~ (Math.random()*5)]];
            // filter out any rectangles that ended up offscreen
            return new_rects.filter(function (rect) {
                    return rect.x >= 0 &&
                           rect.y >= 0 &&
                           rect.x+rect.w <= width &&
                           rect.y + rect.h <= height;
                });
        },
        toString : function () {
            return '[' + ['x:'+this.x, 'y:'+this.y, 'w:'+this.w, 'h:'+this.h].join(',') + ']';
        }
    }


    function PixelBuffer(image_data, buffer_w, buffer_h) {
        var pixels = [],
            data = image_data.data,
            i, y, x;
        // image_data is the raw pixel data for the entire image, and we need
        // to grab the rectangle we're actually interested in.
        for (y = 0; y < buffer_h; y++) {
            for (x = buffer_w-1; x >= 0; x--) {
                // find the index into the image_data buffer of the pixel we're interested in
                // need to multiply by 4 because image_data is an array of 4-byte RGBA sequences
                i = (y * buffer_w + x) * 4; 
                pixels.push(rgb_to_lab(data[i+0], data[i+1], data[i+2]));
            }
        }
        this.pixels = pixels;
        this.buffer_w = buffer_w;
        this.buffer_h = buffer_h;
    }

    PixelBuffer.prototype = {
        pixelsInRectangle : function (rect) {
            var pixels = [],
                y, x, i,
                y_stop = rect.y + rect.h > height ? height : rect.y + rect.h;
            for (y = rect.y; y < y_stop; y++) {
                for (x = rect.x; x < rect.x + rect.w; x += sampling) {
                //for (x = rect.x + rect.w - 1; x >= rect.x; x -= sampling) {
                    i = (y * this.buffer_w + (this.buffer_w - x - 1)); 
                    //i = (y * this.buffer_w + x); 
                    pixels.push(this.pixels[i]);
                }
            }
            return pixels;
            
        },
        three_axis_stddev : function (pixels) {
            var // use an object to force sparseness
                sum_l  = 0,
                sum_l2 = 0,
                sum_a  = 0,
                sum_a2 = 0,
                sum_b  = 0,
                sum_b2 = 0,
                l, a, b,
                mean_l,
                mean_a,
                mean_b,
                count = pixels.length;
                //index;
            pixels.forEach(function (pixel, i, arr) {
                l = pixel[0];
                a = pixel[1];
                b = pixel[2];
                sum_l += l;
                sum_l2 += (l*l);
                sum_a += a;
                sum_a2 += (a*a);
                sum_b += b;
                sum_b2 += (b*b);
            });
            mean_l = sum_l / count;
            mean_a = sum_a / count;
            mean_b = sum_b / count;
            return {
                means : [mean_l, mean_a, mean_b],
                stddevs : [
                        Math.sqrt(sum_l2 / count - (mean_l * mean_l)),
                        Math.sqrt(sum_a2 / count - (mean_a * mean_a)),
                        Math.sqrt(sum_b2 / count - (mean_b * mean_b))
                    ]
                };
        },
        dominantColor : function (rect) {
            var pixels,
                result,
                means,
                stddevs,
                color_index,
                color,
                confidence;
            if (typeof rect === 'undefined') {
                pixels = this.pixels;
            } else {
                pixels = this.pixelsInRectangle(rect);
            }
            result = this.three_axis_stddev(pixels);
            means = result.means;
            stddevs = result.stddevs;
            color = [ ~~means[0], ~~means[1], ~~means[2] ];
            // TODO: is there a better way to estimate total standard deviation
            // other than suming them?
            confidence = stddevs[0] + stddevs[1] + stddevs[2];
            return {color:color, confidence:confidence};
        },
        segmentIntoConsistentlyColoredRectangles : function (args) {
            var min_length          = args.min_length,
                include_unconfident = args.include_unconfident,
                rectangles          = args.rectangles,
                required_confidence = args.required_confidence,
                scale_confidence    = args.scale_confidence,
                result = [],
                rect,
                dominant_color,
                expected_confidence;

            while (rectangles.length) {
                rect = rectangles.pop();
                if (scale_confidence) {
                    // scale the required_confidence as the rectangle size diminishes
                    expected_confidence = required_confidence + (10 / rect.w);
                } else {
                    expected_confidence = required_confidence;
                }
                dominant_color = this.dominantColor(rect);
                if (dominant_color.confidence < expected_confidence) {
                    //result.push([rect, dominant_color]);
                    result.push([rect, dominant_color]);
                } else {
                    if (rect.w <= min_length) {
                        // if the rectangle has become too small, then only include it if we want "unconfident" ones
                        if (include_unconfident) {
                            result.push([rect, dominant_color]);
                        }
                    } else {
                        rect.divide().forEach(function (sub_rect) {
                            // TODO: unshift is slow
                            rectangles.unshift(sub_rect);
                        });
                    }
                }
            }
            return result;
         }
    };



    // A priority queue that allows for removal of non-head members
    function PQueue() {

        // initialise the queue and offset
        var queue  = [];
        var offset = 0;

                // REPLACE
        this.queue = queue;

        // Returns the length of the queue.
        this.getLength = function(){
            return (queue.length - offset);
        };

        // Returns true if the queue is empty, and false otherwise.
        this.isEmpty = function(){
            return (queue.length == 0);
        };

        /* Enqueues the specified item. The parameter is:
        *
        * item - the item to enqueue
        */
        this.enqueue = function(item){
            queue.push(item);
        };


        this.each = function (fn) {
            var i;
            for (i = offset; i < queue.length; i++) {
                fn(queue[i]);
            }
        };

        /* Dequeues an item and returns it. If the queue is empty, the value
        * 'undefined' is returned.
        */
        this.dequeue = function(){
            // if the queue is empty, return immediately
            if (queue.length == 0) return undefined;

            // store the item at the front of the queue
            var item = queue[offset];

            // increment the offset and remove the free space if necessary
            if (++ offset * 2 >= queue.length){
                queue  = queue.slice(offset);
                offset = 0;
            }

            // return the dequeued item
            return item;
        };

        this.remove = function (item) {
            var index = queue.indexOf(item, offset);
            if (index === -1) {
                console.error('could not find item in queue to remove');
            } else {
                queue = queue.slice(offset, index).concat(queue.slice(index+1));
                offset = 0;
            }
        };

        /* Returns the item at the front of the queue (without dequeuing it). If the
        * queue is empty then undefined is returned.
        */
        this.peek = function(){
            return (queue.length > 0 ? queue[offset] : undefined);
        };
    }




});

