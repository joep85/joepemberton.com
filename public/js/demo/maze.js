(function() {

    'use strict';
    var joe = angular.module('joepemberton.com');

    function Coord(x, y) {
        this.x = x;
        this.y = y;
    }
    Coord.prototype = {
        distance : function (c) {
            // Manhattan distance
            return (this.x-c.x) + (this.y-c.y);
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
        },
        check: function() {
            if (!this.isOpen()) {
                delete this.maze.openTiles[this.hash];
            }
        },
        getNeighbors: function() {
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
        draw: function() {
            var ctx = this.maze.ctx;
            var x = this.coord.x * Tile.SIZE;
            var y = this.coord.y * Tile.SIZE;
            for (var mask in Tile.MASK_RECT) {
                if (this.value & mask) {
                    var rect = Tile.MASK_RECT[mask];
                    ctx.fillRect(x + rect[0], y + rect[1], rect[2], rect[3]);
                }
            }
        },
        outline: function() {
            var ctx = this.maze.ctx;
            var x = this.coord.x * Tile.SIZE;
            var y = this.coord.y * Tile.SIZE;
            ctx.strokeRect(x, y, Tile.SIZE, Tile.SIZE);
        }
    };

    Tile.UP      = 1 << 0;
    Tile.RIGHT   = 1 << 1;
    Tile.LEFT    = 1 << 2;
    Tile.DOWN    = 1 << 3;
    Tile.SIZE    = 10;
    Tile.MID     = Tile.SIZE / 2;
    Tile.STROKE  = 5;
    Tile.STROKE_OFFSET = (Tile.STROKE - 1) / 2;
    Tile.MASK_RECT = {};
    Tile.MASK_RECT[Tile.UP]     = [Tile.MID - Tile.STROKE_OFFSET, 0, Tile.STROKE, Tile.MID + Tile.STROKE_OFFSET];
    Tile.MASK_RECT[Tile.RIGHT]  = [Tile.MID, Tile.MID - Tile.STROKE_OFFSET, Tile.MID + Tile.STROKE_OFFSET, Tile.STROKE];
    Tile.MASK_RECT[Tile.DOWN]   = [Tile.MID - Tile.STROKE_OFFSET, Tile.MID, Tile.STROKE, Tile.MID + Tile.STROKE_OFFSET];
    Tile.MASK_RECT[Tile.LEFT]   = [0, Tile.MID - Tile.STROKE_OFFSET, Tile.MID + Tile.STROKE_OFFSET, Tile.STROKE];

    function rand(limit) {
        return Math.floor(Math.random() * limit);
    }


    function Maze(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.ctx.fillStyle = "white";
        this.width = canvas.width / Tile.SIZE;
        this.height = canvas.height / Tile.SIZE;
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
        console.log("seed: " + seed.coord.x + "," + seed.coord.y);
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
            this.getTile(0, rand(this.height)).set(Tile.LEFT);
            this.getTile(this.width-1, rand(this.height)).set(Tile.RIGHT);
        }
    };


    joe.controller('MazeController', [
        '$scope',
        '$element',
        '$interval',
        function($scope, $element, $interval) {

            var canvas = $element.find('canvas')[0];
            var maze = new Maze(canvas);
            window.maze = maze;
            maze.fill();



  
        }
    ]);

    window.Tile = Tile;


})();
