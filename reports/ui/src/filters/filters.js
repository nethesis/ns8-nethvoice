import Vue from "vue"
import lodash from 'lodash';

function moment(...args) {
    return window.moment(...args);
}

var Filters = {
    formatDate(date) {
        var d = new Date(date),
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();

        if (month.length < 2)
            month = '0' + month;
        if (day.length < 2)
            day = '0' + day;

        return [year, month, day].join('-');
    },
    formatMonthDate(value) {
        // value: e.g. "2020-10"
        const monthYear = moment(value, "YYYY-MM").format("MMMM YYYY");
        return lodash.upperFirst(monthYear);
    },
    formatMonth(value) {
        // value: e.g. "10" (october)
        const monthName = moment(value, "MM").format("MMMM");
        return lodash.upperFirst(monthName);
    },
    formatWeekDate(value, i18n) {
        // value: e.g. "2019-W50" (week 50 of 2019)
        const tokens = value.split("-W");
        const year = tokens[0];
        const weekNum = parseInt(tokens[1]);
        const firstDay = moment().year(year).week(weekNum).isoWeekday(1).format('YYYY-MM-DD');
        const lastDay = moment().year(year).week(weekNum).isoWeekday(7).format('YYYY-MM-DD');
        return (i18n ? i18n.t("misc.week") : "week") + " " + weekNum + " (" + firstDay + " - " + lastDay + ")";
    },
    formatNumber(value) {
        const num = parseFloat(value);

        if (isNaN(num)) {
            return "-";
        }
        return num.toLocaleString();
    },
    formatPercentage(value) {
        const num = parseFloat(value);

        if (isNaN(num)) {
            return "-";
        }
        return num.toLocaleString() + " %";
    },
    formatTime: function (value) {
        if (value == "" || (!value && value != 0)) {
            return '-'
        }

        value = Math.round(value);
        var ret = "";
        let days = parseInt(Math.floor(value / (3600 * 24)));
        let hours = parseInt(Math.floor((value - days * (3600 * 24)) / 3600));
        let minutes = parseInt(Math.floor((value - days * (3600 * 24) - hours * 3600) / 60));
        let seconds = parseInt((value - (hours * 3600 + minutes * 60)) % 60);

        if (!days && !hours && !minutes && !seconds) {
            return "0s";
        } else {
            if (seconds) {
                ret = seconds + "s";
            }
            if (minutes) {
                ret = minutes + "m " + ret;
            }
            if (hours) {
                ret = hours + "h " + ret;
            }
            if (days) {
                ret = days + "d " + ret;
            }
            return ret;
        }
    },
    formatTwoDecimals: function (value) {
        if (value == "") {
            value = 0;
        }

        // round to two decimal places
        const currencyValue = Math.round((parseFloat(value) + Number.EPSILON) * 100) / 100;
        return currencyValue.toLocaleString();
    },
    formatCurrency: function (value, currency) {
        if (value == "") {
            value = 0;
        }

        // round to two decimal places
        const currencyValue = Math.round((parseFloat(value) + Number.EPSILON) * 100) / 100;
        return currencyValue.toLocaleString() + " " + currency;
    },
    reversePhonebookLookup: function (phoneNumber, field, root) {
        // field can be "name", "company" or "name|company"

        if (!root.reversePhonebook[phoneNumber]) {
            // search phone number in phonebook
            const contactFound = root.phonebook.find(contact => {
                // flatten phone numbers data structure and search phone number
                const phoneFound = [].concat(...Object.values(contact.phones)).find(phone => {
                    return phone == phoneNumber;
                });
                return phoneFound;
            });

            if (contactFound) {
                // add entry to reverse phonebook
                root.reversePhonebook[phoneNumber] = {
                    "name": contactFound.title.split(" | ")[0],
                    "company": contactFound.company,
                }
            } else {
                // phone number not present in phonebook
                root.reversePhonebook[phoneNumber] = {
                    "name": "-",
                    "company": "-",
                }
            }
        }

        if (field == "name|company") {
            const contact = root.reversePhonebook[phoneNumber];

            if (contact.name == "-") {
                return "-";
            } else {
                if (contact.company && contact.company != "-") {
                    return contact.name + " | " + contact.company;
                } else {
                    return contact.name;
                }
            }
        } else {
            return root.reversePhonebook[phoneNumber][field];
        }
    },
    formatCommasList: function (value) {
        return value.replace(/,/g, ', ')
    }
};

for (var f in Filters) {
    Vue.filter(f, Filters[f])
}
