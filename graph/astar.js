(function () {

    var FIXED_PATH = '<span class="f">.</span>',
        POTENTIAL_PATH = '<span class="p">.</span>';

    function assert(condition, message) {
        if (!condition) {
            throw new Exception(message);
        }
    }

    function PriorityQueue() {
        this.queue = [];
    }
    PriorityQueue.prototype = {
        add : function (priority, item) {
            this.queue.push([priority, item]);
            this.queue.sort(function (a, b) {
                return b[0] - a[0];
            });
        },
        peek : function () {
            if (this.queue.length) {
                return this.queue[this.queue.length-1][1];
            } else {
                return null;
            }
        },
        pop : function () {
            if (this.queue.length) {
                return this.queue.pop()[1];
            } else {
                return null;
            }
        }
    };
    window.pq = PriorityQueue;

    function PathItem(prev, coord, goal_coord) {
        this.prev = prev;
        this.coord = coord;
        if (prev) {
            this.cost = prev.cost + prev.coord.distance(coord);
        } else {
            this.cost = 0;
        }
        this.goal_cost = coord.distance(goal_coord);
        this.fixed = false;
    }
    PathItem.prototype = {
        total_cost : function () {
            return this.cost + this.goal_cost;
        }
    };



    function Coord(x, y) {
        this.x = x;
        this.y = y;
    }
    Coord.prototype = {
        distance : function (c) {
            return Math.sqrt( (this.x-c.x)*(this.x-c.x) + (this.y-c.y)*(this.y-c.y) );
        }
    };




    function Map(map_data) {
        this.height   = map_data.length;
        this.width    = map_data[0].length;
        this.map_data = map_data.join('').toUpperCase();
        this.start    = this.position_of('S');
        this.end      = this.position_of('E');
        if (!this.start) {
            throw new Exception('map does not contain an entrance');
        }
        if (!this.end) {
            throw new Exception('map does not contain an exit');
        }
        this.paths = [];
        this.paths.length = this.height * this.width;
        this.path_queue = new PriorityQueue();
        this.add_path(null, this.start);
        this.found = false;
        this.finished = false;
    }
    Map.prototype = {
        // gets the map character at position x,y
        get_map_char : function (c) {
            return this.map_data[this.index_of_coord(c)];
        },
        get_path : function (c) {
            return this.paths[this.index_of_coord(c)];
        },
        index_of_coord : function (coord) {
            return coord.y * this.width + coord.x;
        },
        add_path : function (prev, coord) {
            var path = new PathItem(prev, coord, this.end),
                index = this.index_of_coord(coord),
                current_path = this.paths[index];
            //if (current_path && current_path.total_cost() > 
            // TODO: evict "current_path" if its cost is higher than "path"
            assert( !this.paths[index], 'Path is already filled??');
            this.path_queue.add(path.total_cost(), path);
            this.paths[index] = path;
        },
        position_of : function (ch) {
            var index = this.map_data.indexOf(ch);
            if (index === -1) {
                return null;
            } else {
                return new Coord(index % this.width, ~~(index / this.width));
            }
        },
        tick : function () {
            if (this.path_queue.queue.length === 0) {
                this.finished = true;
                return;
            }
            var best_path = this.path_queue.pop(),
                end_path = this.get_path(this.end),
                index = this.index_of_coord(best_path.coord),
                self = this;
            best_path.fixed = true;
            if (end_path && end_path.total_cost() < this.path_queue.peek().total_cost()) {
                // DONE!
                this.found = true;
                this.finished = true;
            }
            this.open_neighbors(best_path.coord).forEach(function (neighbor) {
                self.add_path(best_path, neighbor);
            });
        },
        draw : function () {
            var arr = this.map_data.split('').map(function (value) {
                    if (value === ' ') {
                        return '<span class="empty">'+value+'</span>';
                    } else {
                        return '<span class="wall">'+value+'</span>';
                    }
                }),
                s,
                self = this,
                p,
                i;
            this.paths.forEach(function (path) {
                if (path) {
                    arr[self.index_of_coord(path.coord)] = path.fixed ? FIXED_PATH : POTENTIAL_PATH;
                }
            });
            if (this.found) {
                p = this.get_path(this.end);
                while (p) {
                    arr[self.index_of_coord(p.coord)] = '<span class="path">@</span>';
                    p = p.prev;
                }
            }
            // split map data into "this.width"-sized chunks
            s = [];
            for (i = 0; i < arr.length; i += this.width) {
                s.push(arr.slice(i, i+this.width).join(''));
            }
            //s = arr.join('').match(new RegExp('.{' + this.width + '}', 'g'));
            return s.join('<br>');
        },
        open_neighbors : function (coord) {
            var self = this;
            return [
                    new Coord(coord.x-1, coord.y-1),
                    new Coord(coord.x,   coord.y-1),
                    new Coord(coord.x+1, coord.y-1),
                    new Coord(coord.x-1, coord.y  ),
                    //[x, y], Don't add the current space!
                    new Coord(coord.x+1, coord.y  ),
                    new Coord(coord.x-1, coord.y+1),
                    new Coord(coord.x,   coord.y+1),
                    new Coord(coord.x+1, coord.y+1)
                ].filter(function (coord) {
                    // filter out the coords that are off the edge of the map
                    return coord.x >= 0 && coord.x < self.width &&
                           coord.y >= 0 && coord.y < self.height;
                }).filter(function (coord) {
                    // filter out the coords that have already been visited
                    return !self.get_path(coord);
                }).filter(function (coord) {
                    // filter out the coords that are not open spaces
                    var ch = self.get_map_char(coord);
                    return ch === ' ' || ch === 'E';
                });
        }
    };

    window.astar = {
        map : function (map_data) {
            window.map = new Map(map_data);
        }
    }
    $(function () {
        var $display = $('#display');
        $('#tick').click(function (evnt) {
            evnt.preventDefault();
            window.map.tick();
            $display.html(window.map.draw());
        });
        $('#run').click(function (evnt) {
            var interval = setInterval(function () {
                window.map.tick();
                $display.html(window.map.draw());
                if (window.map.finished) {
                    clearInterval(interval);
                }
            }, 5);
            evnt.preventDefault();
        });
        $display.html(window.map.draw());
    });
})();
