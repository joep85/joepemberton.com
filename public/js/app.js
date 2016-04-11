(function() {
    'use strict';

    var joe = angular.module('joepemberton.com', ['ngRoute', 'ngResource']);

    joe.config([
        '$routeProvider',
        '$locationProvider',
        function($routeProvider, $locationProvider) {
            $routeProvider
            .when('/foo', {
                templateUrl : '/partials/index.html',
                controller : 'FooController'
            })
            .when('/demo/:demo_id', {
                templateUrl : function(urlattr) {
                    return '/partials/demo/' + urlattr.demo_id + '.html';
                }
            })
            .when('/resume', {
                templateUrl : '/partials/resume.html'
            })
            .when('/', {
                templateUrl : '/partials/index.html',
                controller : 'RootController'
            })
            .otherwise({
                redirectTo: '/'
            });
            $locationProvider.html5Mode(true);
        }]);
    

    joe.controller('RootController', [
        '$scope',
        function($scope) {
            $scope.foo = "hello world";
        }]);
    
    joe.controller('FooController', [
        '$scope',
        function($scope) {
            $scope.foo = "foo hello world";
        }]);

    joe.controller('MenuController', [
        '$scope',
        function($scope) {
            var link = function(name, href) {
                return { 'name' : name, 'href' : href };
            };
            var section = function(name) {
                console.log(arguments);
                return {
                    'name' : name,
                    'links' : Array.prototype.slice.call(arguments, 1)
                };
            };
            $scope.sections = [
                section('', 
                    link('Home', '/'),
                    link('Resume', '/resume')),
                section('Demos', 
                    link('A* search', '/demo/a-star'),
                    link('Photo mirror', '/demo/photo-mirror'))
            ];
        }]);
    
})();
