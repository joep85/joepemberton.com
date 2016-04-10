$(function () {
    var video = document.querySelector('#video'),
        canvas = document.querySelector('#canvas'),
        outcanvas = document.querySelector('#out'),
        msg = document.querySelector('#msg'),
        startmsg = document.querySelector('#startmsg'),
        controls = document.querySelector('#controls'),
        context  = canvas.getContext('2d'),
        outcontext = outcanvas.getContext('2d'),

        outpixel = outcontext.createImageData(1,1),
        outpixel_data = outpixel.data,

        MIN_FRAME_TIME = 50,

        CANNY_CUTOFF = 20,

        video_width = 420,
        video_height,
        out_scale = 10,
        SOBEL_MASK_X = [
            [-1, 0, 1],
            [-2, 0, 2],
            [-1, 0, 1]
        ],
        SOBEL_MASK_Y = [
            [1, 2, 1],
            [0, 0, 0],
            [-1, -2, -1]
        ],

        GAUSSIAN_MASK = [
            [ 2,  4,  5,  4, 2 ],
            [ 4,  9, 12,  9, 4 ],
            [ 5, 12, 15, 12, 5 ],
            [ 4,  9, 12,  9, 4 ],
            [ 2,  4,  5,  4, 2 ]
        ],
        LAPLACE_MASK = [
            [ -1, -1, -1, -1, -1 ],
            [ -1, -1, -1, -1, -1 ],
            [ -1, -1, 24, -1, -1 ],
            [ -1, -1, -1, -1, -1 ],
            [ -1, -1, -1, -1, -1 ]
        ],
        config = {
            treatment : 'sobel'
        };

    if (document.location.hash) {
        config.treatment = document.location.hash.substring(1);
    }

    $('#controls')
    .append('<span data-treatment="gaussian">Gaussian Blur</span>')
    .append('<span data-treatment="sobel">Sobel</span>')
    .append('<span data-treatment="sobel_x">Sobel X</span>')
    .append('<span data-treatment="sobel_y">Sobel Y</span>')
    .append('<span data-treatment="laplace">Laplace</span>')
    .append('<span data-treatment="canny">Canny</span>')
    .find('[data-treatment]')
    .click(function () {
        config.treatment = $(this).attr('data-treatment');
        $(document).trigger('changetreatment');
    });

    $(document)
    .on('changetreatment', function () {
        $('#controls .active').removeClass('active');
        $('#controls [data-treatment="' + config.treatment + '"]').addClass('active');
        document.location.replace('#' + config.treatment);
    }).trigger('changetreatment');


    function asLittleEndianHex(value, bytes) {
        var result = [];
        for (; bytes>0; bytes--) {
            result.push(String.fromCharCode(value & 255));
            value >>= 8;
        }
        return result.join('');
    }

    
    

    video.addEventListener('canplay', _.once(function () {
        setTimeout(function () {
            video_height = video.videoHeight / (video.videoWidth/video_width);
            video.setAttribute('width', video_width);
            video.setAttribute('height', video_height);
            canvas.setAttribute('width', video_width);
            canvas.setAttribute('height', video_height);

            setInterval(renderFrame, MIN_FRAME_TIME);
        }, 500);
    }));

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
            $('body').addClass('started');
            video.play();
        },
        function (err) {
            console.error('could not connect to video stream: ' + err);
        });



    function renderFrame() {
        var img = new Image();
        canvas.width = video_width;
        canvas.height = video_height;
        outcanvas.width = video_width * out_scale;
        outcanvas.height = video_height * out_scale;
        context.drawImage(video, 0, 0, video_width, video_height);
        image_data = context.getImageData(0, 0, video_width, video_height);
        pixel_buffer = new EdgePixelBuffer(image_data, video_width, video_height);

        switch (config.treatment) {
            case 'sobel':
                sobel(pixel_buffer);
                break;
            case 'sobel_x':
                sobel_x(pixel_buffer);
                break;
            case 'sobel_y':
                sobel_y(pixel_buffer);
                break;
            case 'gaussian':
                gaussian(pixel_buffer);
                break;
            case 'laplace':
                laplace(pixel_buffer);
                break;
            case 'canny':
                canny(pixel_buffer);
                break;
        }
        img.src = generateBitmapDataURL(pixel_buffer);
        outcontext.drawImage(img, 0, 0, video_width * out_scale, video_height * out_scale);
    }


    function sobel(pixel_buffer) {
        var gradient_x = convolve(pixel_buffer, SOBEL_MASK_X, true, 1),
            gradient_y = convolve(pixel_buffer, SOBEL_MASK_Y, true, 1),
            gradient = [],
            len = gradient_x.length,
            i;
        for (i = 0; i < len; i++) {
            gradient.push(Math.abs(gradient_x[i]) + Math.abs(gradient_y[i]));
        }
        pixel_buffer.pixels = gradient;
    }
    function sobel_x(pixel_buffer) {
        pixel_buffer.pixels = convolve(pixel_buffer, SOBEL_MASK_X, true, 1);
    }

    function sobel_y(pixel_buffer) {
        pixel_buffer.pixels = convolve(pixel_buffer, SOBEL_MASK_Y, true, 1);
    }

    function gaussian(pixel_buffer) {
        pixel_buffer.pixels = convolve(pixel_buffer, GAUSSIAN_MASK);
    }

    function laplace(pixel_buffer) {
        pixel_buffer.pixels = convolve(pixel_buffer, LAPLACE_MASK, true, 1);
    }

    function canny(pixel_buffer) {
        var blurred,
            buffer_w = pixel_buffer.buffer_w,
            buffer_h = pixel_buffer.buffer_h,
            gradient_x,
            gradient_y,
            gradients = [],
            directions = [],
            normalized = [],
            gradient,
            direction,
            index,
            a, b,
            get_gradient = function (x, y) {
                return (x < 0 || x >= buffer_w || y < 0 || y >= buffer_h) ?
                    0 : gradients[y * buffer_w + x];
            };
        pixel_buffer.pixels = convolve(pixel_buffer, GAUSSIAN_MASK);
        gradient_x = convolve(pixel_buffer, SOBEL_MASK_X, true, 1);
        gradient_y = convolve(pixel_buffer, SOBEL_MASK_Y, true, 1);

        for (y = 0; y < buffer_h; y++) {
            for (x = 0; x < buffer_w; x++) {
                index = y * buffer_w + x;
                gradients.push(
                    (x < 0 || x >= buffer_w || y < 0 || y >= buffer_h)
                    ? -1
                    : Math.abs(gradient_x[index]) + Math.abs(gradient_y[index])
                );
                directions.push(Math.atan2(gradient_y[index], gradient_x[index]) * 180 / Math.PI);
            }
        }
        for (y = 0; y < buffer_h; y++) {
            //normalized.push(0);
            for (x = 0; x < buffer_w; x++) {
                index = y * buffer_w + x;
                direction = directions[index];
                if (direction < 0) {
                    direction += 180;
                }
                gradient = gradients[index];
                if (direction > 67.5 && direction <= 112.5) {
                    // North-south
                    a = get_gradient(x, y - 1);
                    b = get_gradient(x, y + 1);
                } else if (direction > 112.5 && direction <= 157.5) {
                    // Northwest - Southeast
                    a = get_gradient(x - 1, y - 1);
                    b = get_gradient(x + 1, y + 1);
                } else if (direction >= 0 && direction <= 22.5 || direction > 157.5 && direction <= 180) {
                    // East - West
                    a = get_gradient(x - 1, y);
                    b = get_gradient(x + 1, y);
                } else if (direction > 22.5 && direction <= 67.5) {
                    // Southwest - Northeast
                    a = get_gradient(x - 1, y + 1);
                    b = get_gradient(x + 1, y - 1);
                }
                if (a > gradient || b > gradient || gradient < CANNY_CUTOFF) {
                    normalized.push(0);
                } else {
                    normalized.push(gradient + (100-gradient) * .5);
                }
            }
            //normalized.push(0);
        }
        pixel_buffer.pixels = normalized;
    }

    function convolve(pixel_buffer, matrix, invert_pixels, divisor) {
        var matrix_w = matrix[0].length,
            matrix_h = matrix.length,
            offset_x = (matrix_w - 1) / 2,
            offset_y = (matrix_h - 1) / 2,
            x, y,
            _x, _y,
            i, j,
            pixels = pixel_buffer.pixels,
            buffer_w = pixel_buffer.buffer_w,
            buffer_h = pixel_buffer.buffer_h,
            sum,
            out = [],
            matrix_sum = matrix.reduce(function (previousValue, currentValue) {
                return previousValue + currentValue.reduce(function (prev, cur) {
                    return prev + cur;
                });
            }, 0),
            row,
            avg;
        if (! divisor) {
            divisor = matrix_sum;
        }
        for (y = 0; y < buffer_h; y++) {
            row = []
            for (x = 0; x < buffer_w; x++) {
                sum = 0;
                sum2 = 0;
                for (i = 0; i < matrix_h; i++) {
                    for (j = 0; j < matrix_w; j++) {
                        _x = x + j - offset_x;
                        _y = y + i - offset_y;
                        if (_x < 0) {
                            _x = 0;
                        }
                        if (_x >= buffer_w) {
                            _x = buffer_w - 1;
                        }
                        if (_y < 0) {
                            _y = 0;
                        }
                        if (_y >= buffer_h) {
                            _y = buffer_h - 1;
                        }
                        sum += matrix[i][j] * pixels[ _y * buffer_w + _x];
                    }
                }
                avg = sum / divisor;
                /*
                if (invert_pixels) {
                    avg = 100 - avg;
                }
                */
                out.push(avg);
            }
        }
        return out;
    }

    function generateBitmapDataURL(pixel_buffer) {
        var width = pixel_buffer.buffer_w,
            height = pixel_buffer.buffer_h,
            row_padding = (4 - (width * 3) % 4) % 4,
            num_data_bytes = (width * 3 + row_padding) * height,
            num_file_bytes = 54 + num_data_bytes,
            file; 
        num_data_bytes = asLittleEndianHex(num_data_bytes, 4);
        num_file_bytes = asLittleEndianHex(num_file_bytes, 4);

        file = ['BM',                // "Magic Number"
                num_file_bytes,      // size of the file (bytes)*
                '\x00\x00',          // reserved
                '\x00\x00',          // reserved
                '\x36\x00\x00\x00',  // offset of where BMP data lives (54 bytes)
                '\x28\x00\x00\x00',  // number of remaining bytes in header from here (40 bytes)
                asLittleEndianHex(width, 4),               // the width of the bitmap in pixels*
                asLittleEndianHex(height, 4),              // the height of the bitmap in pixels*
                '\x01\x00',          // the number of color planes (1)
                '\x18\x00',          // 24 bits / pixel
                '\x00\x00\x00\x00',  // No compression (0)
                num_data_bytes,      // size of the BMP data (bytes)*
                '\x13\x0B\x00\x00',  // 2835 pixels/meter - horizontal resolution
                '\x13\x0B\x00\x00',  // 2835 pixels/meter - the vertical resolution
                '\x00\x00\x00\x00',  // Number of colors in the palette (keep 0 for 24-bit)
                '\x00\x00\x00\x00',  // 0 important colors (means all colors are important)
                _collapseData(pixel_buffer, row_padding)
               ].join('');
        return 'data:image/bmp;base64,' + btoa(file);
    }

    function _collapseData(pixel_buffer, row_padding) {
        var width = pixel_buffer.buffer_w,
            height = pixel_buffer.buffer_h,
            bytes = pixel_buffer.pixels,
            i,
            j,
            pixel,
            padding = '',
            result = [],
            val;

        for (; row_padding > 0; row_padding--) {
            padding += '\x00';
        }

        for (i=height-1; i>=0; i--) {
            for (j=0; j<width; j++) {
                val = bytes[i * width + j];
                if (val < 0) {
                    val = 0;
                }
                if (val > 100) {
                    val = 100;
                }
                pixel = String.fromCharCode(~~((100-val) / 100 * 255));
                result.push(pixel + pixel + pixel);
            }
            result.push(padding);
        }
        return result.join('');
    }

    function EdgePixelBuffer(image_data, buffer_w, buffer_h) {
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
                pixels.push(rgb_to_lab(data[i+0], data[i+1], data[i+2])[0]);
            }
        }
        this.pixels = pixels;
        this.buffer_w = buffer_w;
        this.buffer_h = buffer_h;
    }



});
