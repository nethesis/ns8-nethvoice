'use strict'

/**
 * @ngdoc directive
 * @name nethvoiceWizardUiApp.directive:dropzone
 * @description
 * # resizer
 */

angular.module('nethvoiceWizardUiApp')
	.directive('dropzone', function(){
    return {
			restrict: 'A',
			link: function(scope, el, attrs){

				let counter = 0

				function dragenter(e) {
					e.stopPropagation()
					e.preventDefault()
					scope.evt.draghover = true
					scope.$apply()
					counter++
				}

				function dragover(e) {
					e.stopPropagation()
					e.preventDefault()
				}

				function dragleave(e) {
					e.stopPropagation()
					e.preventDefault()
					counter--
					if (counter === 0) {
						scope.evt.draghover = false
						scope.$apply()
					}
				}

				function drop(e) {
					e.stopPropagation()
					e.preventDefault()
					counter = 0
					scope.evt.draghover = false
					scope.$apply()
					let files = e.originalEvent.dataTransfer.files
					let file = files[0]
					scope.fileUpload(file, scope.uploadProgress)
				}
			
				el.bind('dragenter', dragenter)
				el.children("div").bind('dragenter', dragenter)
				el.bind('dragover', dragover)
				el.bind('dragleave', dragleave)
				el.bind('drop', drop)
			
				function change(e){
					let files = e.target.files
					let file = files[0]
					scope.fileUpload(file, scope.uploadProgress)
				}
			
				let input = el.children("input")
				input.bind('change', change)

			}
    }
	})