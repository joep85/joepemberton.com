(function () {

    'use strict';

    var joe = angular.module('joepemberton.com');

    var FIXED_PATH = "\u25A1", POTENTIAL_PATH = ".";
    var PATH = "\u25A0";

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
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

    joe.controller('AStarController', [
        '$scope',
        '$element',
        '$interval',
        function($scope, $element, $interval) {

            var paths;
            var path_queue;
            var interval;
            var map_data;
            var mapHeight;
            var mapWidth;
            var startCoord;
            var endCoord;

            $scope.$on('$destroy', function() {
                if (angular.isDefined(interval)) {
                    $interval.cancel(interval);
                    interval = undefined;
                }
            });

            var init = function() {
                var $el = $element.find('textarea');
                var rows = $el.val().replace(/[^# SE\n]/g, ' ').split('\n');
                var max = rows.map(function(v) { return v.length; }).reduce(function(a, b) { return Math.max(a,b); });
                mapWidth = Math.min(max, 100);
                mapHeight = rows.length;

                map_data = rows.map(function(v) {
                    if (v.length < mapWidth) {
                        v = v + new Array(mapWidth - v.length).join(' ');
                    }
                    return v.substring(0, mapWidth);
                }).join('');

                startCoord = position_of('S');
                endCoord = position_of('E');
                if (!startCoord) {
                    throw new Error('map does not contain an entrance');
                }
                if (!endCoord) {
                    throw new Error('map does not contain an exit');
                }

                paths = [];
                paths.length = mapHeight * mapWidth;
                path_queue = new PriorityQueue();
                add_path(null, startCoord);
                $scope.found = false;
                $scope.finished = false;
                $scope.iteration = 0;
            };

            $scope.run = function() {
                init();
                interval = $interval(function () {
                    tick();
                    if ($scope.finished) {
                        $interval.cancel(interval);
                    }
                }, 5);
            };
            var get_map_char = function (coord) {
                return map_data[coord.index()];
            };
            var get_path = function (coord) {
                return paths[coord.index()];
            };
            var add_path = function (prev, coord) {
                var path = new PathItem(prev, coord, endCoord),
                    index = coord.index(),
                    current_path = paths[index];
                //if (current_path && current_path.total_cost() > 
                // TODO: evict "current_path" if its cost is higher than "path"
                assert( !paths[index], 'Path is already filled??');
                path_queue.add(path.total_cost(), path);
                paths[index] = path;
            };

            function position_of(ch) {
                var index = map_data.indexOf(ch);
                if (index === -1) {
                    return null;
                } else {
                    return new Coord(index % mapWidth, ~~(index / mapWidth));
                }
            }

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
                },
                index : function() {
                    return this.y * mapWidth + this.x;
                }
            };

            var tick = function () {
                if (path_queue.queue.length === 0) {
                    $scope.finished = true;
                    return;
                }
                var best_path = path_queue.pop(),
                    end_path = get_path(endCoord),
                    index = best_path.coord.index();
                best_path.fixed = true;
                if (end_path && end_path.total_cost() < path_queue.peek().total_cost()) {
                    // DONE!
                    $scope.found = true;
                    $scope.finished = true;
                }
                open_neighbors(best_path.coord).forEach(function (neighbor) {
                    add_path(best_path, neighbor);
                });
                $scope.iteration = $scope.iteration + 1;
                draw();
            };
            var draw = function () {
                var arr = map_data.split('');
                paths.forEach(function (path) {
                    if (path) {
                        arr[path.coord.index()] = path.fixed ? FIXED_PATH : POTENTIAL_PATH;
                    }
                });
                if ($scope.found) {
                    var p = get_path(endCoord);
                    while (p) {
                        arr[p.coord.index()] = PATH;
                        p = p.prev;
                    }
                }
                // split map data into "mapWidth"-sized chunks
                var s = [];
                for (var i = 0; i < arr.length; i += mapWidth) {
                    s.push(arr.slice(i, i + mapWidth).join(''));
                }
                $scope.display = s.join('\n');
            };
            var open_neighbors = function (coord) {
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
                        return coord.x >= 0 && coord.x < mapWidth &&
                               coord.y >= 0 && coord.y < mapHeight;
                    }).filter(function (coord) {
                        // filter out the coords that have already been visited
                        return !get_path(coord);
                    }).filter(function (coord) {
                        // filter out the coords that are not open spaces
                        var ch = get_map_char(coord);
                        return ch === ' ' || ch === 'E';
                    });
            }

            /*
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
            */
    }]);
})();
