(function (App) {
    'use strict';

    var Q = require('q');
    var request = require('request');
    var inherits = require('util').inherits;

    function MovieAPI() {
        if (!(this instanceof MovieAPI)) {
            return new MovieAPI();
        }

        App.Providers.Generic.call(this);
    }
    inherits(MovieAPI, App.Providers.Generic);

    MovieAPI.prototype.extractIds = function (items) {
        return _.pluck(items.results, 'imdb_id');
    };

    var format = function (data) {
        var results = _.chain(data.movies)
            .filter(function (movie) {
                // Filter any 3D only movies
                return _.any(movie.torrents, function (torrent) {
                    return torrent.quality !== '3D';
                });
            }).map(function (movie) {
                return {
                    type: 'movie',
                    imdb_id: movie.imdb_code,
                    title: movie.title_english,
                    year: movie.year,
                    genre: movie.genres,
                    rating: movie.rating,
                    runtime: movie.runtime,
                    image: movie.medium_cover_image,
                    cover: movie.medium_cover_image,
                    backdrop: movie.background_image_original,
                    synopsis: movie.description_full,
                    trailer: 'https://www.youtube.com/watch?v=' + movie.yt_trailer_code || false,
                    certification: movie.mpa_rating,
                    torrents: _.reduce(movie.torrents, function (torrents, torrent) {
                        if (torrent.quality !== '3D') {
                            torrents[torrent.quality] = {
                                url: torrent.url,
                                magnet: 'magnet:?xt=urn:btih:' + torrent.hash + '&tr=udp://glotorrents.pw:6969/announce&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://torrent.gresille.org:80/announce&tr=udp://tracker.openbittorrent.com:80&tr=udp://tracker.coppersurfer.tk:6969&tr=udp://tracker.leechers-paradise.org:6969&tr=udp://p4p.arenabg.ch:1337&tr=udp://tracker.internetwarriors.net:1337',
                                size: torrent.size_bytes,
                                filesize: torrent.size,
                                seed: torrent.seeds,
                                peer: torrent.peers
                            };
                        }
                        return torrents;
                    }, {})
                };
            }).value();

        return {
            results: Common.sanitize(results),
            hasMore: data.movie_count > data.page_number * data.limit
        };
    };

    MovieAPI.prototype.fetch = function (filters) {
        var params = {
            sort_by: 'seeds',
            limit: 50,
            with_rt_ratings: true
        };

        if (filters.page) {
            params.page = filters.page;
        }

        if (filters.keywords) {
            params.query_term = filters.keywords;
        }

        if (filters.genre && filters.genre !== 'All') {
            params.genre = filters.genre;
        }

        if (filters.order === 1) {
            params.order_by = 'asc';
        }

        if (filters.sorter && filters.sorter !== 'popularity') {
            switch (filters.sorter) {
                case 'last added':
                    params.sort_by = 'date_added';
                    break;
                case 'trending':
                    params.sort_by = 'trending_score';
                    break;
                default:
                    params.sort_by = filters.sorter;
            }
        }

        if (Settings.movies_quality !== 'all') {
            params.quality = Settings.movies_quality;
        }

        if (Settings.translateSynopsis) {
            params.lang = Settings.language;
        }

        var defer = Q.defer();

        function get(index) {
            var options = {
                url: Settings.movieAPI[index].url + 'api/v2/list_movies.json',
                qs: params,
                json: true,
                timeout: 10000
            };
            var req = jQuery.extend(true, {}, Settings.movieAPI[index], options);
            request(req, function (err, res, data) {
                if (err || res.statusCode >= 400 || (data && !data.data)) {
                    win.warn('Movie API endpoint \'%s\' failed.', Settings.movieAPI[index].url);
                    if (index + 1 >= Settings.movieAPI.length) {
                        return defer.reject(err || 'Status Code is above 400');
                    } else {
                        get(index + 1);
                    }
                    return;
                } else if (!data || data.status === 'error') {
                    err = data ? data.status_message : 'No data returned';
                    return defer.reject(err);
                } else {
                    return defer.resolve(format(data.data));
                }
            });
        }
        get(0);

        return defer.promise;
    };

    MovieAPI.prototype.random = function () {
        var defer = Q.defer();

        function get(index) {
            var options = {
                url: Settings.movieAPI[index].url + 'api/v2/get_random_movie.json?' + Math.round((new Date()).valueOf() / 1000),
                json: true,
                timeout: 10000
            };
            var req = jQuery.extend(true, {}, Settings.movieAPI[index], options);
            request(req, function (err, res, data) {
                if (err || res.statusCode >= 400 || (data && !data.data)) {
                    win.warn('Movie API endpoint \'%s\' failed.', Settings.movieAPI[index].url);
                    if (index + 1 >= Settings.movieAPI.length) {
                        return defer.reject(err || 'Status Code is above 400');
                    } else {
                        get(index + 1);
                    }
                    return;
                } else if (!data || data.status === 'error') {
                    err = data ? data.status_message : 'No data returned';
                    return defer.reject(err);
                } else {
                    return defer.resolve(Common.sanitize(data.data));
                }
            });
        }
        get(0);

        return defer.promise;
    };

    MovieAPI.prototype.detail = function (torrent_id, old_data) {
        return Q(old_data);
    };

    App.Providers.MovieAPI = MovieAPI;

})(window.App);