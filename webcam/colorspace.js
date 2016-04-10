var WHITE = {X: 0.9505, Y: 1.0000, Z: 1.0890},
    RGB_SIGBITS = 6;

function rgb_to_lab(r, g, b) {
    var rgb = [ r/255, g/255, b/255],
        temp = [],
        x,y,z,
        X,Y,Z,
        i,
        f = function (t) {
            if ( t > ( 6.0 / 29.0 ) * ( 6.0 / 29.0 ) * (6.0 / 29.0 ) ) {
                return Math.pow( t, 1.0 / 3.0 );
            } else {
                return ( 1.0 / 3.0 ) * 
                    ( 29.0 / 6.0 ) * ( 29.0 / 6.0 ) * t +
                    4.0 / 29.0;
            }
        };
    // Do RGB to XYZ conversion
    for ( var i = 0; i < 3; i++ ) {
        if ( rgb[i] <= 0.04045 ) {
            temp[i] = rgb[i] / 12.92;
        } else {
            temp[i] = Math.pow( (rgb[i]+0.055)/1.055, 2.4 );
        }
    }
    x = 0.4124*temp[0]+0.3576*temp[1]+0.1805*temp[2];
    y = 0.2126*temp[0]+0.7152*temp[1]+0.0722*temp[2];
    z = 0.0193*temp[0]+0.1192*temp[1]+0.9505*temp[2];
    
    // do XYZ to LAB conversion
    X = f( x / WHITE.X );
    Y = f( y / WHITE.Y );
    Z = f( z / WHITE.Z );
    
    return [ 116 * Y - 16, 500 * ( X - Y ), 200 * ( Y - Z ) ];
    /*
    return {
            l: 116 * Y - 16,
            a: 500 * ( X - Y ),
            b: 200 * ( Y - Z )
        };
    */
}


function lab_to_rgb( l, a, b ) {
    var temp = [];
    var values = [];
    var fy = ( l + 16 ) / 116;
    var fx = fy + a / 500;
    var fz = fy - b / 200;

    var squiggle = 6.0 / 29;
    var x, y, z;
    var r, g, b;

    if ( fy > squiggle ) {
        y = WHITE.Y * fy * fy * fy;
    } else {
        y = ( fy - 16.0 / 116 ) * 3 * squiggle * squiggle * WHITE.Y;
    }

    if ( fx > squiggle ) {
        x = WHITE.X * fx * fx * fx;
    } else {
        x = ( fx - 16.0 / 116 ) * 3 * squiggle * squiggle * WHITE.X;
    }

    if ( fz > squiggle ) {
        z = WHITE.Z * fz * fz * fz;
    } else {
        z = ( fz - 16.0 / 116 ) * 3 * squiggle * squiggle * WHITE.Z;
    }

    temp[0] =  3.2410 * x - 1.5374 * y - 0.4986 * z;
    temp[1] = -0.9692 * x + 1.8760 * y + 0.0416 * z;
    temp[2] =  0.0556 * x - 0.2040 * y + 1.0570 * z;

    for ( var i = 0; i < 3; i++ ) {
        if ( temp[i] <= 0.0031308 ) {
            values[i] = 12.92 * temp[i];
        } else {
            values[i] = 1.055 * Math.pow( temp[i], 1.0 / 2.4 ) - 0.055;
        }
        values[i] = ~~(values[i]*255)

        // WOW, this bug makes everything blue and green:
        //values[i] = ~~(values[1]*255)
        //values[i] = 255 - ~~(values[i]*255)
    }

    return values;

}

function toHex(value) {
    var str = '00' + value.toString(16);
    return str.substring(str.length-2);
}

function rgb_to_hex( list ) {
    return '#' + list.map(toHex).join('');
}

function quicklab(lab) {
    return rgb_to_hex(lab_to_rgb.apply(this, lab));
}


window.fast_rgb_to_lab = (function () {
    var lookup = [],
        shift = 8 - RGB_SIGBITS,
        mask = (255 >> shift),
        lookup_table_size = (mask+1)*(mask+1)*(mask+1),
        i,
        r,g,b,
        val;

    for (i = 0; i < lookup_table_size; i++) {
        r = ((i>>(RGB_SIGBITS *2)) & mask) << shift;
        g = ((i>> RGB_SIGBITS) & mask) << shift;
        b = (i & mask) << shift;
        val = rgb_to_lab(r,g,b);
        lookup.push(val);
    }
    window.lookup = lookup;
    return function (r, g, b) {
            var index = ((r >> shift) << (RGB_SIGBITS*2)) |
                        ((g >> shift) << (RGB_SIGBITS)) |
                        (b >> shift);
            return lookup[index];
        };

})();
