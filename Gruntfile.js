var fs = require('fs');
var path = require('path');
var process = require('process');

module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-replace');


	const sass = require('node-sass');

	require('load-grunt-tasks')(grunt); //sass

	grunt.registerTask('default', [
		'build'
	]);


	grunt.registerTask('build', [
		'clean:pre',
		'copy:scss',
		'copy:scss_plugins',
		'sass:build',
		'postcss:prefix',
		'postcss:min',
		'replace:css_post',

		'shell:buildjs',
	]);

	grunt.registerTask('serve', [
		'build',
		'builddocs',
		'connect',
		'check_doc_links',
		'watch'
	])

	grunt.registerTask('builddocs',[
		'clean:builddocs',
		'shell:builddocs',
		'replace:builddocs',
		'sass:builddocs',
		'postcss:builddocs',
	]);



	/**
	 * Check generated docs for broken links
	 * https://www.npmjs.com/package/broken-link-checker
	 */
	grunt.registerTask('check_doc_links','',function(){
		var done = this.async();
		const {SiteChecker} = require('broken-link-checker');
		const options = {
			excludeExternalLinks: true,
			cacheMaxAge:60,
		};

		var urls_checked	= 0;
		var links_checked	= 0;
		var failures		= 0;


		const handlers = {
			error:function(error){
				failures++;
				console.log('error',error);
			},
			page:function(error, page_url, customData){
				if( error ){
					failures++;
					console.log('error!',page_url);
				}

				urls_checked++;
			},
			junk:function( result, data ){

				links_checked++;
				if( result.broken ){
					failures++;
					console.log('broken junk found',result);
				}
			},
			link:function(link){
				if( link.broken ){
					failures++;
					console.log('broken link',link);
				}
			},
			end:function(){
				console.log('urls checked',urls_checked);
				console.log('links checked',links_checked);
				console.log('failures',failures);

				done(failures==0);
			}
		};

		const checker = new SiteChecker(options,handlers)
		checker.enqueue('http://localhost:8000/', {});
	});


	// build tom-select.custom.js
	var plugin_arg			= grunt.option('plugins');
	var custom_file			= path.resolve( process.cwd(),'./src/tom-select.custom.js');
	var custom_content		= ['import TomSelect from "./tom-select.js"; '];

	if( fs.existsSync(custom_file) ){
		fs.unlink(custom_file,err => {
			if (err) {
				console.error(err)
			}
		});
	}

	if( plugin_arg ){
		var plugin_args	= plugin_arg.split(/\s*,\s*/);

		plugin_args.map(function(plugin_name){
			custom_content.push(`import ${plugin_name} from './plugins/${plugin_name}/plugin.js'; `);
		});
		custom_content.push('export default TomSelect;');

		fs.writeFile(custom_file, custom_content.join("\n"),err => {
			if (err) {
				console.error(err)
			}
		});
	}



	// find all plugin scss files
	var scss_plugin_files	= [];
	var matched_files = grunt.file.expand(['src/plugins/*/plugin.scss']);
	for (var i = 0, n = matched_files.length; i < n; i++) {
		var plugin_name = matched_files[i].match(/src\/plugins\/(.+?)\//)[1];
		scss_plugin_files.push({src: matched_files[i], dest: 'build/scss/plugins/' + plugin_name + '.scss'});
	}



	// bootstrap browserlist https://github.com/twbs/bootstrap/blob/main/.browserslistrc
	var autoprefixer = require('autoprefixer')();




	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		// delete old build files
		clean: {
			pre: ['build/*'],
			js: ['build/*.js'],
			builddocs: ['build/docs/*']
		},

		// copy scss files to build folder
		copy: {
			scss:{
				files: [{
					'build/scss/tom-select.scss': ['src/scss/tom-select.scss'],
					'build/scss/tom-select.default.scss': ['src/scss/tom-select.default.scss'],
					'build/scss/tom-select.bootstrap3.scss': ['src/scss/tom-select.bootstrap3.scss'],
					'build/scss/tom-select.bootstrap4.scss': ['src/scss/tom-select.bootstrap4.scss'],
				}]
			},
			scss_plugins:{
				files: scss_plugin_files
			},
		},

		// replace @@version with current package version
		replace: {
			options: {
				prefix: '//@@',
				variables: {
					'version': '<%= pkg.version %>',
				},
			},
			// add version to css & scss headers
			css_post: {
				files: [
					{expand: true, flatten: false, src: ['build/css/*.css'], dest: ''},
					{expand: true, flatten: false, src: ['build/scss/*.scss'], dest: ''},
				]
			},
			builddocs:{
				files:[
					{src:['build/docs/js/index.js'],dest:'build/docs/js/index.js'}
				]
			}
		},


		// compile css from scss
		sass: {
			options:{
				implementation: sass,
				style:'expanded',
			},
			build: {
				files: [{
					'build/css/tom-select.css': ['src/scss/tom-select.scss'],
					'build/css/tom-select.default.css': ['src/scss/tom-select.default.scss'],
					'build/css/tom-select.bootstrap3.css': ['src/scss/-tom-select.bootstrap3.scss'],
					'build/css/tom-select.bootstrap4.css': ['src/scss/-tom-select.bootstrap4.scss'],
				}]
			},
			builddocs: {
				files: [{
					expand: true,
					flatten: true,
					ext: '.css',
					src: ['doc_src/css/*.scss'],
					dest: 'build/docs/css'
				}],
			}
		},

		// autoprefix && cssnanao
		postcss: {
			prefix: {
				options:{
					map: {
						inline: false, // save all sourcemaps as separate files...
					},
					processors: [
						//require('pixrem')(), // add fallbacks for rem units
						autoprefixer,
					]
				},
				files: [{expand: true, flatten: false, src: ['build/css/*.css'], dest: ''}],
			},
			min: {
				options: {
					map: {
						inline: false, // save all sourcemaps as separate files...
					},
					processors: [
						require('cssnano')() // minify the result
					]
				},
				files: [{
					'build/css/tom-select.min.css': ['build/css/tom-select.css'],
					'build/css/tom-select.default.min.css': ['build/css/tom-select.default.css'],
					'build/css/tom-select.bootstrap3.min.css': ['build/css/tom-select.bootstrap3.css'],
					'build/css/tom-select.bootstrap4.min.css': ['build/css/tom-select.bootstrap4.css'],
				}]
			},
			builddocs:{
				options:{
					map: {
						inline: false, // save all sourcemaps as separate files...
					},
					processors: [
						autoprefixer,
						require('cssnano')() // minify the result
					]
				},
				files: [{
					expand: true,
					flatten: true,
					src: ['build/docs/css/*.css'],
					dest: 'build/docs/css'
				}],
			},
		},

		// run server at http://localhost:8000 to view documentation and run examples
		connect: {
			server:{
				options: {
					base: 'build/docs',
				}
			}
		},

		// generate /build/docs
		shell: {
			builddocs: {
				command: 'npx @11ty/eleventy --config=.config/eleventy.js',
			},
			buildjs: {
				command: 'npx rollup -c .config/rollup.config.js',
			},
		},

		// watch for changes to files in /doc_src or /src
		watch: {
			docs:{
				files:[
					'doc_src/**',
				],
				tasks:[
					'builddocs',
					'check_doc_links',
				]
			},
			src:{
				files: [
					'src/**',
				],
				tasks: [
					'default',
					'builddocs',
					'check_doc_links',
				]
			}
		}
	});
};
