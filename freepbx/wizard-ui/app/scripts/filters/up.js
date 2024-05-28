'use strict';
/**
 * @ngdoc filter
 * @name nethvoiceWizardUiApp.filter:toBase64
 * @function
 * @description
 * # up
 * Filter in the nethvoiceWizardUiApp.
 */
angular.module('nethvoiceWizardUiApp')
  .filter('up', function () {
    return function (arr, search) {
      if (search == "") return arr
      const reg = /[a-zA-Z0-9]*/g
      let newArr = []
      // search the mac address
      newArr = arr.filter(el => {
        return el.mac.match(reg)
          .filter(n => n)
          .join("")
          .toLowerCase()
          .includes(
            search.match(reg)
            .filter(n => n)
            .join("")
            .toLowerCase())
      })
      // search the brand and the model 
      if (newArr.length == 0) {
        newArr = arr.filter(el => {
          return (
            el.model.name.toLowerCase().includes(search.toLowerCase()) ||
            el.model.display_name.toLowerCase().includes(search.toLowerCase()) ||
            el.vendor.toLowerCase().includes(search.toLowerCase())
          )
        })
      }
      return newArr   
    }
  });
  