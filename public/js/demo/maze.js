(function() {

    'use strict';
    var joe = angular.module('joepemberton.com');

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

    function Coord(x, y) {
        this.x = x;
        this.y = y;
    }
    Coord.prototype = {
        distance : function (c) {
            // Manhattan distance
            return Math.abs(this.x-c.x) + Math.abs(this.y-c.y);
        },
        neighbors: function() {
            return [
                new Coord(this.x,   this.y-1),
                new Coord(this.x-1, this.y  ),
                new Coord(this.x+1, this.y  ),
                new Coord(this.x,   this.y+1)
            ];
        },
        direction: function(other) {
            if (this.x === other.x - 1 && this.y === other.y) { return Tile.RIGHT; }
            if (this.x === other.x + 1 && this.y === other.y) { return Tile.LEFT; }
            if (this.y === other.y - 1 && this.x === other.x) { return Tile.DOWN; }
            if (this.y === other.y + 1 && this.x === other.x) { return Tile.UP; }
            throw new Error("Coord is not a neighbor");
        }
    };

    function Tile(maze, coord) {
        this.maze = maze;
        this.coord = coord;
        this.hash = coord.x + ',' + coord.y;
        this.value = 0;
        this.neighbors = null;
    }
    Tile.prototype = {
        set: function(direction) {
            this.value |= direction;
            this.draw();
            this.maze.openTiles[this.hash] = this;
            this.check();
            return this;
        },
        check: function() {
            if (!this.isOpen()) {
                delete this.maze.openTiles[this.hash];
            }
        },
        getNeighbors: function() {
            var maze = this.maze;
            if (this.neighbors === null) {
                this.neighbors = this.coord.neighbors().map(function(neighborCoord) {
                    return maze.getTile(neighborCoord);
                }).filter(function(neighborTile) {
                    return neighborTile != null;
                });
            }
            return this.neighbors;
        },
        isOpen: function() {
            // a tile is considered 'open' if at least one of its neighbors has a non-zero tile value
            return this.emptyNeighbors().length > 0;
        },
        emptyNeighbors: function() {
            return this.getNeighbors().filter(function(neighbor) {
                return neighbor.value === 0;
            });
        },
        connectedNeighbors: function() {
            var tiles = [];
            var x = this.coord.x;
            var y = this.coord.y;
            if (this.value & Tile.UP)    { tiles.push(this.maze.getTile(x, y-1)); }
            if (this.value & Tile.RIGHT) { tiles.push(this.maze.getTile(x+1, y)); }
            if (this.value & Tile.DOWN)  { tiles.push(this.maze.getTile(x, y+1)); }
            if (this.value & Tile.LEFT)  { tiles.push(this.maze.getTile(x-1, y)); }
            return tiles.filter(function(tile) { return tile !== null; });
        },
        draw: function() {
            var ctx = this.maze.ctx;
            var x = this.coord.x * this.maze.tileSize;
            var y = this.coord.y * this.maze.tileSize;
            for (var mask in this.maze.maskRect) {
                if (this.value & mask) {
                    var rect = this.maze.maskRect[mask];
                    ctx.fillRect(x + rect[0], y + rect[1], rect[2], rect[3]);
                }
            }
        },
        outline: function() {
            var ctx = this.maze.ctx;
            var x = this.coord.x * this.maze.tileSize;
            var y = this.coord.y * this.maze.tileSize;
            ctx.strokeRect(x, y, this.maze.tileSize, this.maze.tileSize);
        }
    };

    Tile.UP      = 1 << 0;
    Tile.RIGHT   = 1 << 1;
    Tile.LEFT    = 1 << 2;
    Tile.DOWN    = 1 << 3;

    function rand(limit) {
        return Math.floor(Math.random() * limit);
    }

    function Maze($q, canvas, tileSize, strokeSize) {
        this.$q = $q;
        this.canvas = canvas;
        this.tileSize = tileSize;
        this.strokeSize = strokeSize;
        this.ctx = canvas.getContext("2d");
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.ctx.fillStyle = "white";
        this.width = Math.floor(canvas.width / tileSize);
        this.height = Math.floor(canvas.height / tileSize);
        this.openTiles = {};
        this.tiles = [];
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var coord = new Coord(x, y);
                this.tiles[this.index(coord)] = new Tile(this, coord);
            }
        }
        var seed = this.getTile(rand(this.width), rand(this.height));
        this.openTiles[seed.hash] = seed;
        var mid     = tileSize / 2;
        var strokeOffset = (strokeSize - 1) / 2;
        this.maskRect = {};
        this.maskRect[Tile.UP]     = [mid - strokeOffset, 0, strokeSize, mid + strokeOffset];
        this.maskRect[Tile.RIGHT]  = [mid, mid - strokeOffset, mid + strokeOffset, strokeSize];
        this.maskRect[Tile.DOWN]   = [mid - strokeOffset, mid, strokeSize, mid + strokeOffset];
        this.maskRect[Tile.LEFT]   = [0, mid - strokeOffset, mid + strokeOffset, strokeSize];
    }
    Maze.prototype = {
        index: function(coord) {
            return coord.y * this.width + coord.x;
        },
        getTile: function(coord) {
            if (arguments.length === 2) {
                coord = new Coord(arguments[0], arguments[1]);
            }
            if (coord.x < 0 || coord.x >= this.width ||
                coord.y < 0 || coord.y >= this.height) {
                return null;
            }
            return this.tiles[this.index(coord)];
        },
        tick: function() {
            var keys = Object.keys(this.openTiles);
            var key = keys[rand(keys.length)];
            var fromTile = this.openTiles[key];
            var neighbors = fromTile.emptyNeighbors();
            var toTile = neighbors[rand(neighbors.length)];

            if (!toTile || !fromTile) {
                debugger;
            }
            var tiles = [fromTile, toTile];
            tiles = tiles.concat(fromTile.getNeighbors());
            tiles = tiles.concat(toTile.getNeighbors());
            fromTile.set(fromTile.coord.direction(toTile.coord));
            toTile.set(toTile.coord.direction(fromTile.coord));
            tiles.forEach(function(tile) {
                tile.check();
            });
        },
        fill: function() {
            while (Object.keys(this.openTiles).length > 0) { 
                this.tick();
            }
            var self = this;
            var makeExit = function() {
                var map = [
                    // left
                    [0, rand(self.height), Tile.LEFT],
                    // right
                    [self.width-1, rand(self.height), Tile.RIGHT],
                    // top
                    [rand(self.width), 0, Tile.UP],
                    //down
                    [rand(self.width), self.height-1, Tile.DOWN]
                ];
                var item = map[rand(map.length)];
                return self.getTile(item[0], item[1]).set(item[2]);
            };
            this.start = makeExit();
            this.end = makeExit();
        },
        solve: function() {
            if (!this.start || !this.end) {
                return;
            }
            var start = this.start;
            var end = this.end;
            var queue = new PriorityQueue();
            var paths = {};
            var deferred = this.$q.defer();
            paths[start.hash] = null;
            queue.add(0, start);
            var ctx = this.ctx;
            var tick = function() {
                var tile = queue.pop();
                ctx.fillStyle = 'blue';
                tile.draw();
                tile.connectedNeighbors().filter(function(n) {
                    return !(n.hash in paths);
                }).forEach(function(n) {
                    ctx.fillStyle = 'green';
                    n.draw();
                    paths[n.hash] = tile;
                    queue.add(n.coord.distance(end.coord), n);
                });
                if (end.hash in paths) {
                    deferred.resolve();
                } else {
                    setTimeout(tick, 0);
                }
            };
            tick();

            deferred.promise.then(function() {
                ctx.fillStyle = 'red';
                var tile = end;
                while (tile) {
                    tile.draw();
                    tile = paths[tile.hash];
                }
            });
        }
    };

    joe.controller('MazeController', [
        '$scope',
        '$element',
        '$interval',
        '$q',
        function($scope, $element, $interval, $q) {
            var canvas = $element.find('canvas')[0];
            var maze;
            $scope.tileSize = 10;
            $scope.generate = function() {
                var tileSize = parseInt($scope.tileSize);
                var strokeSize = tileSize / 2;
                maze = new Maze($q, canvas, tileSize, strokeSize % 2 == 0 ? strokeSize + 1 : strokeSize);
                maze.fill();
                window.maze = maze;
            };
            $scope.solve = function() {
                maze.solve();
            };
            $scope.generate();
        }
    ]);

})();
