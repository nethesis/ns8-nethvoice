<template>
  <div>
    <sui-container v-show="this.showFiltersForm">
      <sui-form class="filters-form" @submit.prevent="applyFilters">
        <!-- saved searches -->
        <sui-form-fields v-if="savedSearches.length" class="mg-bottom-md">
          <sui-form-field width="four" class="mb-10">
            <sui-dropdown
              :placeholder="$t('filter.saved_search')"
              search
              selection
              v-model="selectedSearch"
              :options="savedSearches"
            />
          </sui-form-field>
          <sui-form-field width="four">
            <sui-button
              type="button"
              negative
              :disabled="!selectedSearch"
              @click.native="showDeleteSearchModal(true)"
              icon="trash"
              >{{ $t("command.delete_search") }}</sui-button
            >
          </sui-form-field>
        </sui-form-fields>
        <!-- group by -->
        <sui-form-fields v-if="showFilterTimeGroup">
          <sui-form-field width="four">
            <label>{{ $t("filter.group_by") }}</label>
            <sui-dropdown
              :options="groupByTimeValuesMap"
              :placeholder="$t('filter.group_by')"
              search
              selection
              v-model="filter.time.group"
            />
          </sui-form-field>
        </sui-form-fields>
        <!-- time interval section -->
        <sui-form-fields class="interval-buttons">
          <!-- CDR ONLY START -->
          <!-- cdr time range -->
          <sui-form-field v-if="showFilterCdrTimeRange" width="four">
            <label class="ellipsis">{{ $t("filter.time_range") }}</label>
            <sui-dropdown
              :text="$t('filter.select_time_range')"
              class="mg-top-xs"
            >
              <sui-dropdown-menu>
                <sui-dropdown-item
                  v-for="timeRange in cdrTimeRangeValues"
                  :key="timeRange"
                  @click="selectTime(timeRange)"
                >
                  {{ $t("filter." + timeRange) }}
                </sui-dropdown-item>
              </sui-dropdown-menu>
            </sui-dropdown>
          </sui-form-field>
          <!-- cdr dashboard time range -->
          <sui-form-field v-if="showFilterCdrDashboardTimeRange" width="four">
            <label class="ellipsis">{{ $t("filter.time_range") }}</label>
            <sui-dropdown
              :options="cdrDashboardTimeRangeValuesMap()"
              :placeholder="$t('filter.time_range_label')"
              search
              selection
              v-model="filter.time.cdrDashboardRange"
            />
          </sui-form-field>
          <!-- CDR ONLY END -->
          <!-- fast time range | if time group is day -->
          <sui-form-field
            v-if="
              (showFilterTime && filter.time.group == 'day') ||
              (showFilterTime && !showFilterTimeGroup)
            "
            width="four"
          >
            <label class="ellipsis">{{ $t("filter.time_range") }}</label>
            <sui-button-group class="fluid">
              <sui-button
                :active="filter.time.range == 'yesterday'"
                @click="selectTime('yesterday')"
                type="button"
                >{{ $t("filter.yesterday") }}</sui-button
              >
              <sui-button
                :active="filter.time.range == 'last_week'"
                @click="selectTime('last_week')"
                type="button"
                >{{ $t("filter.last_week") }}</sui-button
              >
              <sui-button
                :active="filter.time.range == 'last_month'"
                @click="selectTime('last_month')"
                type="button"
                >{{ $t("filter.last_month") }}</sui-button
              >
            </sui-button-group>
          </sui-form-field>
          <!-- fast time range | if time group is week -->
          <sui-form-field
            v-if="
              showFilterTime &&
              filter.time.group == 'week' &&
              showFilterTimeGroup
            "
            width="four"
          >
            <label class="ellipsis">{{ $t("filter.time_range") }}</label>
            <sui-button-group class="fluid">
              <sui-button
                :active="filter.time.range == 'last_week'"
                @click="selectTime('last_week')"
                type="button"
                >{{ $t("filter.last_week") }}</sui-button
              >
              <sui-button
                :active="filter.time.range == 'last_two_weeks'"
                @click="selectTime('last_two_weeks')"
                type="button"
                >{{ $t("filter.last_two_weeks") }}</sui-button
              >
              <sui-button
                :active="filter.time.range == 'last_month'"
                @click="selectTime('last_month')"
                type="button"
                >{{ $t("filter.last_month") }}</sui-button
              >
            </sui-button-group>
          </sui-form-field>
          <!-- fast time range | if time group is month -->
          <sui-form-field
            v-if="
              showFilterTime &&
              filter.time.group == 'month' &&
              showFilterTimeGroup
            "
            width="four"
          >
            <label class="ellipsis">{{ $t("filter.time_range") }}</label>
            <sui-button-group class="fluid">
              <sui-button
                :active="filter.time.range == 'last_month'"
                @click="selectTime('last_month')"
                type="button"
                >{{ $t("filter.last_month") }}</sui-button
              >
              <sui-button
                :active="filter.time.range == 'last_two_months'"
                @click="selectTime('last_two_months')"
                type="button"
                >{{ $t("filter.last_two_months") }}</sui-button
              >
              <sui-button
                :active="filter.time.range == 'last_six_months'"
                @click="selectTime('last_six_months')"
                type="button"
                >{{ $t("filter.last_six_months") }}</sui-button
              >
            </sui-button-group>
          </sui-form-field>
          <!-- fast time range | if time group is year -->
          <sui-form-field
            v-if="
              showFilterTime &&
              filter.time.group == 'year' &&
              showFilterTimeGroup
            "
            width="four"
          >
            <label class="ellipsis">{{ $t("filter.time_range") }}</label>
            <sui-button-group class="fluid">
              <sui-button
                :active="filter.time.range == 'last_year'"
                @click="selectTime('last_year')"
                type="button"
                >{{ $t("filter.last_year") }}</sui-button
              >
              <sui-button
                :active="filter.time.range == 'last_two_years'"
                @click="selectTime('last_two_years')"
                type="button"
                >{{ $t("filter.last_two_years") }}</sui-button
              >
              <sui-button
                :active="filter.time.range == 'last_three_years'"
                @click="selectTime('last_three_years')"
                type="button"
                >{{ $t("filter.last_three_years") }}</sui-button
              >
            </sui-button-group>
          </sui-form-field>
          <!-- datapickers section queues -->
          <sui-form-field
            v-show="$route.meta.report == 'queue'"
            class="datepicker-field"
            width="four"
          >
            <label :class="{ 'error-color': errorTimeInterval }">{{
              $t("filter.time_interval")
            }}</label>
            <!-- time interval start -->
            <!-- datetime -->
            <date-picker
              v-show="showFilterTimeHour"
              v-model="filter.time.interval.start"
              type="datetime"
              :placeholder="$t('filter.time_interval_start_placeholder')"
              :clearable="false"
              :show-second="false"
              :disabled-date="fromToday"
              :class="{ 'field-error': errorTimeInterval, 'full-width': true, 'mt-2': true }"
              :formatter="momentFormatter"
              :lang="$i18n.vm.locale"
            ></date-picker>
            <!-- date / week / month / year -->
            <date-picker
              v-show="!showFilterTimeHour"
              v-model="filter.time.interval.start"
              :type="
                !showFilterTimeGroup || filter.time.group == 'day'
                  ? 'date'
                  : filter.time.group == 'week'
                  ? 'week'
                  : filter.time.group == 'month'
                  ? 'month'
                  : 'year'
              "
              :placeholder="$t('filter.time_interval_start_placeholder')"
              :clearable="false"
              :show-second="false"
              :disabled-date="fromToday"
              :class="{ 'field-error': errorTimeInterval, 'full-width': true, 'mt-2': true }"
              :formatter="momentFormatter"
              :lang="$i18n.vm.locale"
            ></date-picker>
          </sui-form-field>
          <sui-form-field
            v-show="$route.meta.report == 'queue'"
            class="datepicker-field"
            width="four"
          >
            <label class="h-19"></label>
            <!-- time interval end -->
            <!-- datetime -->
            <date-picker
              v-show="showFilterTimeHour"
              v-model="filter.time.interval.end"
              type="datetime"
              :placeholder="$t('filter.time_interval_end_placeholder')"
              :clearable="false"
              :show-second="false"
              :disabled-date="fromToday"
              :class="{ 'field-error': errorTimeInterval, 'full-width': true, 'mt-2': true }"
              :formatter="momentFormatter"
              :lang="$i18n.vm.locale"
            ></date-picker>
            <!-- date / week / month / year -->
            <date-picker
              v-show="!showFilterTimeHour"
              v-model="filter.time.interval.end"
              :type="
                !showFilterTimeGroup || filter.time.group == 'day'
                  ? 'date'
                  : filter.time.group == 'week'
                  ? 'week'
                  : filter.time.group == 'month'
                  ? 'month'
                  : 'year'
              "
              :placeholder="$t('filter.time_interval_end_placeholder')"
              :clearable="false"
              :show-second="false"
              :disabled-date="fromToday"
              :class="{ 'field-error': errorTimeInterval, 'full-width': true, 'mt-2': true }"
              :formatter="momentFormatter"
              :lang="$i18n.vm.locale"
            ></date-picker>
          </sui-form-field>
          <!-- CDR ONLY START -->
          <!-- datapickers section cdr -->
          <sui-form-field
            v-show="$route.meta.report == 'cdr'"
            class="datepicker-field"
            width="four"
          >
            <label :class="{ 'error-color': errorTimeInterval }">{{
              $t("filter.time_interval")
            }}</label>
            <!-- time interval start -->
            <!-- datetime -->
            <date-picker
              v-model="filter.time.interval.start"
              type="datetime"
              :placeholder="$t('filter.time_interval_start_placeholder')"
              :clearable="false"
              :show-second="false"
              :disabled-date="fromToday"
              :class="{ 'field-error': errorTimeInterval, 'full-width': true, 'mt-2': true }"
              :formatter="momentFormatter"
              :lang="$i18n.vm.locale"
              :disabled="$route.meta.section == 'dashboard'"
            ></date-picker>
          </sui-form-field>
          <sui-form-field
            v-show="$route.meta.report == 'cdr'"
            class="datepicker-field"
            width="four"
          >
            <label class="h-19"></label>
            <!-- time interval end -->
            <!-- datetime -->
            <date-picker
              v-model="filter.time.interval.end"
              type="datetime"
              :placeholder="$t('filter.time_interval_end_placeholder')"
              :clearable="false"
              :show-second="false"
              :disabled-date="fromToday"
              :class="{ 'field-error': errorTimeInterval, 'full-width': true, 'mt-2': true }"
              :formatter="momentFormatter"
              :lang="$i18n.vm.locale"
              :disabled="$route.meta.section == 'dashboard'"
            ></date-picker>
          </sui-form-field>
          <!-- CDR ONLY END -->
        </sui-form-fields>
        <sui-grid class="fields">
          <!-- queues -->
          <sui-form-field v-if="showFilterQueue" width="four">
            <label>{{ $t("filter.queues_label") }}</label>
            <sui-dropdown
              multiple
              :options="filterValues.queues"
              :placeholder="$t('filter.queues_label')"
              search
              selection
              v-model="filter.queues"
            />
          </sui-form-field>
          <sui-form-field v-if="showFilterAgent" width="four">
            <label>{{ $t("filter.agents_label") }}</label>
            <sui-dropdown
              multiple
              :options="agentsFilteredByQueue"
              :placeholder="$t('filter.agents_label')"
              search
              selection
              v-model="filter.agents"
            />
          </sui-form-field>
          <!-- reason -->
          <sui-form-field v-if="showFilterReason" width="four">
            <label>{{ $t("filter.reasons_label") }}</label>
            <sui-dropdown
              multiple
              :options="filterValues.reasons"
              :placeholder="$t('filter.reasons_label')"
              search
              selection
              v-model="filter.reasons"
            />
          </sui-form-field>
          <!-- result -->
          <sui-form-field v-if="showFilterResult" width="four">
            <label>{{ $t("filter.results_label") }}</label>
            <sui-dropdown
              multiple
              :options="filterValues.results"
              :placeholder="$t('filter.results_label')"
              search
              selection
              v-model="filter.results"
            />
          </sui-form-field>
          <!-- ivr -->
          <sui-form-field v-if="showFilterIvr" width="four">
            <label>{{ $t("filter.ivrs_label") }}</label>
            <sui-dropdown
              multiple
              :options="filterValues.ivrs"
              :placeholder="$t('filter.ivrs_label')"
              search
              selection
              v-model="filter.ivrs"
            />
          </sui-form-field>
          <!-- ivr's defined choices based on selected ivr -->
          <sui-form-field v-if="showFilterChoice" width="four">
            <label>{{ $t("filter.choices_label") }}</label>
            <sui-dropdown
              multiple
              :options="filterValues.choices"
              :placeholder="$t('filter.choices_label')"
              search
              selection
              v-model="filter.choices"
            />
          </sui-form-field>
          <!-- origin -->
          <sui-form-field v-if="showFilterOrigin" width="four">
            <label>{{ $t("filter.origins_label") }}</label>
            <sui-dropdown
              multiple
              :options="filterValues.origins"
              :placeholder="$t('filter.origins_placeholder')"
              search
              selection
              v-model="filter.origins"
            />
          </sui-form-field>
          <!-- geo group -->
          <sui-form-field v-if="showFilterGeoGroup" width="four">
            <label>{{ $t("filter.geo_group") }}</label>
            <sui-dropdown
              :options="geoGroupValuesMap"
              search
              selection
              v-model="filter.geoGroup"
            />
          </sui-form-field>
          <!-- time split -->
          <sui-form-field v-if="showFilterTimeSplit" width="four">
            <label>{{ $t("filter.time_split_label") }}</label>
            <sui-dropdown
              :options="splitByTimeValuesMap"
              :placeholder="$t('filter.time_split_label')"
              search
              selection
              v-model="filter.time.division"
            />
          </sui-form-field>
          <!-- caller -->
          <sui-form-field v-if="showFilterCaller" width="four">
            <label>{{ $t("filter.caller_label") }}</label>
            <sui-input
              :placeholder="$t('filter.caller_label')"
              v-model="filter.caller"
            />
          </sui-form-field>
          <!-- contact  -->
          <sui-form-field v-if="showFilterContactName" width="four">
            <label>{{ $t("filter.contact_name_label") }}</label>
            <div class="ui search searchContactName">
              <sui-input
                :placeholder="$t('filter.contact_name_label')"
                v-model="filter.contactName"
                @input="contactNameInput"
                @focus="contactNameFocus"
                @blur="contactNameBlur"
              />
              <div
                v-show="searchContactResults.length && showSearchResults"
                :class="[
                  'results',
                  'transition',
                  showSearchResults ? 'visible' : 'hidden',
                ]"
              >
                <div
                  v-for="(contact, index) in searchContactResults"
                  v-bind:key="index"
                  class="result"
                  @click="selectContact(contact)"
                >
                  <div class="content">
                    <div class="title">{{ contact.title }}</div>
                  </div>
                </div>
              </div>
            </div>
          </sui-form-field>
          <!-- CDR ONLY START -->
          <!-- EVERYWHERE -->
          <!-- cdr: sources / caller -->
          <sui-form-field v-show="showFilterCdrCaller" width="four">
            <label key="caller_label">
              <span>{{ $t("filter.caller") }}</span>
              <sui-popup flowing hoverable position="top center">
                <div class="doc-info markdown">
                  <VueShowdown :markdown="callerCalleeDoc"></VueShowdown>
                </div>
                <sui-icon
                  name="info circle"
                  class="doc-info-icon"
                  slot="trigger"
                />
              </sui-popup>
            </label>
            <SearchInput
              :options="filterValues.cdrCaller"
              :placeholder="$t('filter.caller_callee_placeholder')"
              :minCharacters="3"
              :searchFields="['title', 'description', 'value']"
              @input="onSourcesInput"
              @select="onSourcesSelect"
              ref="sourcesUi"
              key="sourcesUi"
            />
          </sui-form-field>
          <!-- cdr: call destinations / callee -->
          <sui-form-field v-show="showFilterCdrCallee" width="four">
            <label key="callee_label">
              <span>{{ $t("filter.callee") }}</span>
              <sui-popup flowing hoverable position="top center">
                <div class="doc-info markdown">
                  <VueShowdown :markdown="callerCalleeDoc"></VueShowdown>
                </div>
                <sui-icon
                  name="info circle"
                  class="doc-info-icon"
                  slot="trigger"
                />
              </sui-popup>
            </label>
            <SearchInput
              :options="filterValues.cdrCallee"
              :placeholder="$t('filter.caller_callee_placeholder')"
              :minCharacters="3"
              :searchFields="['title', 'description', 'value']"
              @input="onDestinationsInput"
              @select="onDestinationsSelect"
              ref="destinationsUi"
              key="destinationsUi"
            />
          </sui-form-field>
          <!-- cdr: call type (result) -->
          <sui-form-field v-if="showFilterCdrCallType" width="four">
            <label>{{ $t("filter.result") }}</label>
            <sui-dropdown
              multiple
              :options="cdrCallTypeMap"
              :placeholder="$t('filter.result')"
              search
              selection
              v-model="filter.callType"
            />
          </sui-form-field>
          <!-- cdr: call duration -->
          <sui-form-field v-show="showFilterCdrCallDuration" width="four">
            <label
              :class="{ 'error-color': errorCallDuration }"
              key="duration_label"
            >
              <span>{{ $t("filter.call_duration") }}</span>
              <sui-popup flowing hoverable position="top center">
                <div class="doc-info">
                  {{ $t("message.call_duration_info") }}
                </div>
                <sui-icon
                  name="info circle"
                  class="doc-info-icon"
                  slot="trigger"
                />
              </sui-popup>
            </label>
            <SearchInput
              :options="cdrCallDurationMap"
              :placeholder="$t('filter.call_duration')"
              :minCharacters="0"
              @input="onDurationInput"
              @select="onDurationSelect"
              @blur="callDurationBlur"
              ref="duration"
              key="duration"
              :showOptionType="false"
              :class="{ 'field-error': errorCallDuration }"
            />
          </sui-form-field>
          <!-- cdr: dids -->
          <sui-form-field v-if="showFilterCdrDid" width="four">
            <label>{{ $t("filter.did") }}</label>
            <sui-dropdown
              multiple
              :options="filterValues.dids"
              :placeholder="$t('filter.did')"
              search
              selection
              v-model="filter.dids"
            />
          </sui-form-field>
          <!-- cdr: trunk -->
          <sui-form-field v-if="showFilterCdrTrunk" width="four">
            <label>{{ $t("filter.trunk") }}</label>
            <sui-dropdown
              multiple
              :options="filterValues.cdrTrunk"
              :placeholder="$t('filter.trunk')"
              search
              selection
              v-model="filter.trunks"
            />
          </sui-form-field>
          <!-- EVERYWHERE END -->
          <!-- cdr: call destinations -->
          <sui-form-field v-if="showFilterCdrCallDestination" width="four">
            <label>{{ $t("filter.call_destination") }}</label>
            <sui-dropdown
              multiple
              :options="callDestinationsMap"
              :placeholder="$t('filter.call_destination')"
              search
              selection
              v-model="filter.callDestinations"
            />
          </sui-form-field>
          <!-- cdr: destination -->
          <sui-form-field v-if="showFilterCdrDestination" width="four">
            <label>{{ $t("filter.destination") }}</label>
            <sui-dropdown
              multiple
              :options="filterValues.cdrPatterns"
              :placeholder="$t('filter.destination')"
              search
              selection
              v-model="filter.patterns"
            />
          </sui-form-field>
          <!-- CDR ONLY END -->
        </sui-grid>
        <!-- filters actions -->
        <sui-form-fields class="mg-top-md filter-actions">
          <sui-button
            primary
            type="submit"
            icon="search"
            :disabled="loader.filter"
            class="mr-15"
            >{{ $t("command.search") }}</sui-button
          >
          <sui-button-group>
            <sui-button
              type="button"
              @click.native="showSaveSearchModal(true)"
              icon="save"
              >{{ $t("command.save_search") }}</sui-button
            >
            <sui-button
              type="button"
              :disabled="!selectedSearch"
              @click.native="showOverwriteSearchModal(true)"
              icon="edit"
              >{{ $t("command.overwrite_search") }}</sui-button
            >
          </sui-button-group>
        </sui-form-fields>
      </sui-form>

      <!-- save search modal -->
      <sui-form
        @submit.prevent="validateSaveNewSearch()"
        :error="errorNewSearch"
      >
        <sui-modal v-model="openSaveSearchModal" size="tiny">
          <sui-modal-header>{{ $t("command.save_search") }}</sui-modal-header>
          <sui-modal-content>
            <sui-modal-description>
              <p>{{ $t("message.enter_name_for_saved_search") }}</p>
              <sui-form-field>
                <input placeholder="Search name" v-model="newSearchName" />
              </sui-form-field>
              <sui-message error v-show="errorNewSearch">
                <p>{{ errorMessage }}</p>
              </sui-message>
            </sui-modal-description>
          </sui-modal-content>
          <sui-modal-actions>
            <sui-button
              type="button"
              @click.native="showSaveSearchModal(false)"
              >{{ $t("command.cancel") }}</sui-button
            >
            <sui-button
              type="submit"
              primary
              :loading="loader.saveSearch"
              :content="$t('command.save')"
            ></sui-button>
          </sui-modal-actions>
        </sui-modal>
      </sui-form>

      <!-- overwrite search modal -->
      <sui-form @submit.prevent="saveSearch(selectedSearch)" warning>
        <sui-modal v-model="openOverwriteSearchModal" size="tiny">
          <sui-modal-header>{{
            $t("command.overwrite_search")
          }}</sui-modal-header>
          <sui-modal-content>
            <sui-modal-description>
              <sui-message warning>
                <i class="exclamation triangle icon"></i>
                {{ $t("message.you_are_about_to_overwrite") }}
                <b>{{ selectedSearch }}</b>
              </sui-message>
              <p>{{ $t("message.are_you_sure") }}</p>
            </sui-modal-description>
          </sui-modal-content>
          <sui-modal-actions>
            <sui-button
              type="button"
              @click.native="showOverwriteSearchModal(false)"
              >{{ $t("command.cancel") }}</sui-button
            >
            <sui-button type="submit" negative>{{
              $t("command.overwrite")
            }}</sui-button>
          </sui-modal-actions>
        </sui-modal>
      </sui-form>

      <!-- delete search modal -->
      <sui-form @submit.prevent="deleteSelectedSearch()" warning>
        <sui-modal v-model="openDeleteSearchModal" size="tiny">
          <sui-modal-header>{{ $t("command.delete_search") }}</sui-modal-header>
          <sui-modal-content>
            <sui-modal-description>
              <sui-message warning>
                <i class="exclamation triangle icon"></i>
                {{ $t("message.you_are_about_to_delete") }}
                <b>{{ selectedSearch }}</b>
              </sui-message>
              <p>{{ $t("message.are_you_sure") }}</p>
            </sui-modal-description>
          </sui-modal-content>
          <sui-modal-actions>
            <sui-button
              type="button"
              @click.native="showDeleteSearchModal(false)"
              >{{ $t("command.cancel") }}</sui-button
            >
            <sui-button
              negative
              type="submit"
              :loading="loader.deleteSearch"
              :content="$t('command.delete')"
            ></sui-button>
          </sui-modal-actions>
        </sui-modal>
      </sui-form>
    </sui-container>
    <FixedBar
      :filter="filter"
      :selectedSearch="selectedSearch"
      :showFilterTimeGroup="showFilterTimeGroup"
      :showFilterTime="showFilterTime"
      :showFilterQueue="showFilterQueue"
      :showFilterAgent="showFilterAgent"
      :showFilterReason="showFilterReason"
      :showFilterResult="showFilterResult"
      :showFilterIvr="showFilterIvr"
      :showFilterChoice="showFilterChoice"
      :showFilterOrigin="showFilterOrigin"
      :showFilterTimeSplit="showFilterTimeSplit"
      :showFilterCaller="showFilterCaller"
      :showFilterContactName="showFilterContactName"
      :showFilterCdrTimeRange="showFilterCdrTimeRange"
      :showFilterCdrCaller="showFilterCdrCaller"
      :showFilterCdrCallee="showFilterCdrCallee"
      :showFilterCdrCallType="showFilterCdrCallType"
      :showFilterCdrCallDuration="showFilterCdrCallDuration"
      :showFilterCdrTrunk="showFilterCdrTrunk"
      :showFilterCdrDid="showFilterCdrDid"
      :showFilterCdrCallDestination="showFilterCdrCallDestination"
      :showFilterCdrDestination="showFilterCdrDestination"
      :showFilterTimeHour="showFilterTimeHour"
      :cdrCallDurationMap="cdrCallDurationMap"
      :callDestinationsMap="callDestinationsMap"
      :filterValues="filterValues"
    />
  </div>
</template>

<script>
import LoginService from "../services/login";
import StorageService from "../services/storage";
import IndexedDbService from "../services/indexedDb";
import SearchesService from "../services/searches";
import UtilService from "../services/utils";
import UiMaps from "../services/uimaps";
import SearchService from "../services/searches";
import PhonebookService from "../services/phonebook";
import FixedBar from "../components/FixedBar.vue";
import FilterService from "../services/filter";
import AuthService from "../services/authorizations";
import SettingsService from "../services/settings";
import SearchInput from "../components/SearchInput";

export default {
  name: "Filters",
  components: {
    FixedBar: FixedBar,
    SearchInput: SearchInput,
  },
  mixins: [
    LoginService,
    StorageService,
    SearchesService,
    UtilService,
    SearchService,
    PhonebookService,
    IndexedDbService,
    FilterService,
    UiMaps,
    SettingsService,
    AuthService
  ],
  props: ["showFiltersForm"],
  data() {
    return {
      PHONEBOOK_DB_NAME: "phonebook",
      PHONEBOOK_DB_VERSION: 1,
      PHONEBOOK_TTL_MINUTES: 8 * 60, // 8 hours
      FILTER_VALUES_TTL_MINUTES: 8 * 60, // 8 hours
      selectedSearch: null,
      filter: {
        queues: [],
        agents: [],
        ivrs: [],
        reasons: [],
        results: [],
        choices: [],
        destinationsUi: {},
        destinations: [],
        origins: [],
        time: {
          group: "",
          division: "",
          range: null,
          cdrDashboardRange: "",
          interval: {
            start: null,
            end: null,
          },
        },
        caller: "",
        contactName: "",
        sourcesUi: {},
        sources: [],
        callType: [],
        durationUi: {},
        duration: "",
        trunks: [],
        callDestinations: [],
        patterns: [],
        dids: [],
        geoGroup: "",
      },
      filterValues: {
        queues: [],
        agents: [],
        ivrs: [],
        reasons: [],
        results: [],
        choices: [],
        allChoices: [],
        origins: [],
        callers: [],
        contactNames: [],
        cdrCaller: [],
        cdrCallee: [],
        cdrTrunk: [],
        ctiGroups: [],
        users: [],
        cdrDestinations: [],
        devices: {},
        cdrPatterns: [],
        dids: [],
        queueAgentsMap: {},
      },
      savedSearches: [],
      openSaveSearchModal: false,
      openOverwriteSearchModal: false,
      openDeleteSearchModal: false,
      newSearchName: "",
      errorNewSearch: false,
      errorTimeInterval: false,
      errorCallDuration: false,
      errorMessage: "",
      loader: {
        filter: true,
        saveSearch: false,
        deleteSearch: false,
      },
      queueReportViewFilterMap: null,
      momentFormatter: {
        stringify: (date) => {
          const dateFormat = this.getDateFormat();
          return date ? window.moment(date).format(dateFormat) : "";
        },
        parse: (value) => {
          const dateFormat = this.getDateFormat();
          return value ? window.moment(value, dateFormat).toDate() : null;
        },
        getWeek(date) {
          return window.moment(date).isoWeek();
        },
      },
      phonebookDb: null,
      phonebookReady: false,
      showSearchResults: false,
      searchContactResults: [],
      currentReport: "",
      callerCalleeDoc: "",
    };
  },
  watch: {
    $route: function () {
      if (this.currentReport !== this.$route.meta.report) {
        this.currentReport = this.$route.meta.report;
        this.getSavedSearches();
        this.setSearchInputs(this.filter);
      }

      // sort saved searches
      if (this.savedSearches) {
        this.mapSavedSearches(this.savedSearches);
      }

      if (
        this.currentReport == "cdr" &&
        this.$route.meta.section == "dashboard"
      ) {
        this.selectTime(this.filter.time.cdrDashboardRange);
      }
    },
    selectedSearch: function () {
      if (this.selectedSearch) {
        this.setFilterValuesFromSearch();
      }
    },
    filtersReady: function () {
      if (this.filtersReady) {
        // notify ContentView that queries can now be executed
        this.$root.filtersReady = true;
      }
    },
    "filter.ivrs": function () {
      this.updateIvrChoices();
    },
    "filter.time.cdrDashboardRange": function () {
      if (
        this.currentReport == "cdr" &&
        this.$route.meta.section == "dashboard"
      ) {
        this.selectTime(this.filter.time.cdrDashboardRange);
      }
    },
    "filter.time.interval": function () {
      if (
        this.filter.time.interval &&
        this.filter.time.interval.start &&
        this.filter.time.interval.end
      ) {
        this.filter.time.range = "";

        // convert to date object if needed
        if (typeof this.filter.time.interval.start == "string") {
          const dateFormat = this.getDateFormat();
          this.filter.time.interval.start = this.moment(
            this.filter.time.interval.start,
            dateFormat
          ).toDate();
        }

        if (typeof this.filter.time.interval.end == "string") {
          const dateFormat = this.getDateFormat();
          this.filter.time.interval.end = this.moment(
            this.filter.time.interval.end,
            dateFormat
          ).toDate();
        }

        if (!this.validateTimeInterval()) {
          return;
        }

        if (
          this.filter.time.interval.end.getTime() ==
          this.getYesterday("end").getTime()
        ) {
          // check time range starting from dates
          switch (this.filter.time.interval.start.getTime()) {
            case this.getYesterday().getTime():
              this.filter.time.range = "yesterday";
              break;
            case this.getLastWeek().getTime():
              this.filter.time.range = "last_week";
              break;
            case this.getLastTwoWeeks().getTime():
              this.filter.time.range = "last_two_weeks";
              break;
            case this.getLastMonth().getTime():
              this.filter.time.range = "last_month";
              break;
            case this.getLastTwoMonths().getTime():
              this.filter.time.range = "last_two_months";
              break;
            case this.getLastSixMonths().getTime():
              this.filter.time.range = "last_six_months";
              break;
            case this.getLastYear().getTime():
              this.filter.time.range = "last_year";
              break;
            case this.getLastTwoYears().getTime():
              this.filter.time.range = "last_two_years";
              break;
            case this.getLastThreeYears().getTime():
              this.filter.time.range = "last_three_years";
              break;
            default:
              break;
          }
        }
      }
    },
    "filter.queues": function () {
      if (this.$route.meta.report === 'queue' && this.$route.meta.name === 'call') {
        // remove selected agents when incompatible with selected queues
        this.filter.agents = this.filter.agents.filter((agent) => {
          return this.agentsFilteredByQueue.some((a) => a.value === agent);
        });
      } else {
        // set agents filter based on selected queues
        if (this.filter.queues.length > 0) {
          this.filter.agents = this.agentsFilteredByQueue.map(agent => agent.value);
        }
      }
    }
  },
  mounted() {
    // check if authorizations were modified to reload
    this.checkAuthModified()
    this.currentReport = this.$route.meta.report;
    this.getSavedSearches();

    // views request to apply filter on loading
    this.$root.$on("requestApplyFilter", this.onRequestApplyFilter);
    this.$root.$on("clearFilters", this.clearFilters);

    if (
      this.currentReport == "cdr" &&
      this.$route.meta.section == "dashboard"
    ) {
      this.selectTime(this.filter.time.cdrDashboardRange);
    }

    this.retrieveCallerCalleeDoc();
  },
  methods: {
    moment(...args) {
      return window.moment(...args);
    },
    onRequestApplyFilter() {
      if (this.loader.filter == false) {
        this.applyFilters();
      }
    },
    mapUserExtensions(users) {
      let userMap = {};

      users.forEach((user) => {
        if (user.value) {
          const extensions = user.value.split(",");

          extensions.forEach((extension) => {
            userMap[extension] = user.title;
          });
        }
      });
      return userMap;
    },
    async checkAuthModified() {
      // check if authorizations were modified in the last 8 hours
      const authModified = await this.getAuthModified()
      const localModTime = this.get("authModTime")
      const modTime = authModified.data.mod_time
      // compare mod times
      if (modTime != localModTime) {
        this.retrieveDefaultFilter()
      } else {
        this.retrieveFilter()
      }
      // update authorizations modification time locally
      this.set("authModTime", modTime)
    },
    retrieveFilter() {
      this.loader.filter = true;
      let filter = this.get(this.reportFilterStorageName);
      let filterValues = this.get(this.reportFilterValuesStorageName);
      // check filters validity
      if (
        filter &&
        filterValues &&
        new Date().getTime() < filterValues.expiry
      ) {
        // get object from local storage item
        filterValues = filterValues.item;
        this.filterValues = filterValues;
        this.$root.devices = this.filterValues.devices;
        this.$root.users = this.mapUserExtensions(this.filterValues.users);

        // set queue into root object
        this.$root.queues = {};
        this.filterValues.queues.forEach((q) => {
          this.$root.queues[q.value] = q.text;
        });

        // set selected values in filter
        this.setFilterSelection(filter, true);
        // retrieve phonebook when
        this.retrievePhonebook();
      } else {
        this.retrieveDefaultFilter();
      }
    },
    callDurationBlur() {
      if (Number(this.$refs.duration.$data.query)) {
        this.$refs.duration.$data.query += " " + this.$t("misc.seconds");
      }
    },
    // add phonebook contacts, CTI groups and users to caller and callee filters
    addToCallerAndCalleeFilters() {
      // users
      this.filterValues.cdrCaller = [...this.filterValues.cdrCaller, ...this.filterValues.users];
      this.filterValues.cdrCallee = [...this.filterValues.cdrCallee, ...this.filterValues.users];

      // cti groups
      this.filterValues.cdrCaller = [...this.filterValues.cdrCaller, ...this.filterValues.ctiGroups];
      this.filterValues.cdrCallee = [...this.filterValues.cdrCallee, ...this.filterValues.ctiGroups];

      // phonebook
      let contacts = this.$root.phonebook.map((contact) => {
        let contactNumbers = [];
        if (
          !this._.isEmpty(contact.phones.cellphones) &&
          contact.phones.cellphones[0] != ""
        )
          contactNumbers.push(contact.phones.cellphones[0]);
        if (
          !this._.isEmpty(contact.phones.homephones) &&
          contact.phones.homephones[0] != ""
        )
          contactNumbers.push(contact.phones.homephones[0]);
        if (
          !this._.isEmpty(contact.phones.workphones) &&
          contact.phones.workphones[0] != ""
        )
          contactNumbers.push(contact.phones.workphones[0]);
        return {
          title: contact.title,
          description: `${contact.cleanName} ${contact.company}`,
          value: contactNumbers.join(","),
          type: "contact",
        };
      });

      this.filterValues.cdrCaller = [...this.filterValues.cdrCaller, ...contacts];
      this.filterValues.cdrCallee = [...this.filterValues.cdrCallee, ...contacts];
    },

    retrieveDefaultFilter() {
      this.getDefaultFilter(
        async (success) => {
          this.defaultFilter = success.body.filter;
          // get cdr destinations values
          await this.getSettingsPromise().then((res) => {
            let destinations = res.settings.destinations.map((element) => {
              return {
                value: element,
                text: !this.$t(`filter.${element.toLowerCase()}`).includes(
                  "filter."
                )
                  ? this.$t(`filter.${element.toLowerCase()}`)
                  : element,
              };
            });
            this.filterValues.cdrPatterns = destinations;
          });

          // cdr dids
          if (this.defaultFilter.dids) {
            this.filterValues.dids = this.defaultFilter.dids.map((did) => {
              return {
                text: did,
                value: did,
              };
            });
          }

          // cdr trunks
          if (this.defaultFilter.trunks) {
            this.filterValues.cdrTrunk = this.defaultFilter.trunks.map(
              (trunk) => {
                let split = trunk.split(",");
                return {
                  text: split[0],
                  value: split[1],
                };
              }
            );
          }

          // cdr cti groups
          if (this.defaultFilter.groups) {
            // prepare for caller / callee
            this.filterValues.ctiGroups = this.defaultFilter.groups.map(
              (group) => {
                let parsedGroup = group.split("|");
                return {
                  title: parsedGroup[0],
                  value: parsedGroup[1],
                  type: "cti_group",
                };
              }
            );
          }

          // cdr users
          if (this.defaultFilter.users) {
            // prepare for caller / callee
            this.filterValues.users = this.defaultFilter.users.map((user) => {
              let parsedUser = user.split("|");
              return {
                title: parsedUser[1],
                value: parsedUser[2],
                type: "user",
              };
            });
            this.$root.users = this.mapUserExtensions(this.filterValues.users);
          }

          // queues
          if (this.defaultFilter.queues) {
            let queues = this.defaultFilter.queues.map((queueName) => {
              const match = /[^(]+\((.+)\)/.exec(queueName);
              const queueNumber = match[1];
              return { value: queueNumber, text: queueName };
            });
            this.filterValues.queues = queues.sort(this.sortByProperty("text"));
            this.$root.queues = {};

            for (const queue of this.filterValues.queues) {
              // set queues into root object
              this.$root.queues[queue.value] = queue.text;
            }
          }

          // agents
          if (this.defaultFilter.agents) {
            let agents = this.defaultFilter.agents.map((agent) => {
              return { value: agent, text: agent };
            });
            this.filterValues.agents = agents.sort(this.sortByProperty("text"));
          }

          // queue/agents map (used to show only agents of selected queues)
          if (this.defaultFilter.queueAgents) {
            let queueAgentsMap = {};
            this.defaultFilter.queueAgents.forEach((qa) => {
              let [queue, agent] = qa.split(",");

              if (queueAgentsMap[queue]) {
                queueAgentsMap[queue].push({ value: agent, text: agent });
              } else {
                queueAgentsMap[queue] = [{ value: agent, text: agent }];
              }
            });
            this.filterValues.queueAgentsMap = queueAgentsMap;
          }

          // ivr
          if (this.defaultFilter.ivrs) {
            let ivrs = this.defaultFilter.ivrs.map((ivr) => {
              const tokens = ivr.split(",");
              const idIvr = tokens[0];
              const ivrName = tokens[1];
              return { value: ivrName, text: ivrName, id: idIvr };
            });
            this.filterValues.ivrs = ivrs.sort(this.sortByProperty("text"));
          }

          // choices: hide duplicates
          if (this.defaultFilter.choices) {
            this.filterValues.allChoices = [];
            let choiceSet = new Set();
            this.defaultFilter.choices.forEach((choice) => {
              const tokens = choice.split(",");
              const idIvr = tokens[0];
              const choiceName = tokens[1];
              this.filterValues.allChoices.push({
                value: choiceName,
                text: choiceName,
                idIvr: idIvr,
              });
              choiceSet.add(choiceName);
            });
            let choices = [];
            choiceSet.forEach((choice) => {
              choices.push({ value: choice, text: choice });
            });
            this.filterValues.choices = choices.sort(
              this.sortByProperty("text")
            );
          }

          // reasons
          if (this.defaultFilter.reasons) {
            let reasons = this.defaultFilter.reasons.map((reason) => {
              const reasonText = this.$te("filter." + reason)
                ? this.$t("filter." + reason)
                : reason;
              return { value: reason, text: reasonText };
            });
            this.filterValues.reasons = reasons.sort(
              this.sortByProperty("text")
            );
          }

          // results
          if (this.defaultFilter.results) {
            let results = this.defaultFilter.results.map((result) => {
              return { value: result, text: result };
            });
            this.filterValues.results = results.sort(
              this.sortByProperty("text")
            );
          }

          // origins
          if (this.defaultFilter.origins) {
            let areaCodes = [];
            let districts = [];
            let provinces = [];
            let regions = [];
            this.defaultFilter.origins.forEach((origin) => {
              const tokens = origin.split(",");
              areaCodes.push({
                value: "areaCode_" + tokens[0],
                text: `${tokens[0]} (${this.$t("filter.area_code")} ${
                  tokens[1]
                })`,
              });
              districts.push({
                value: "district_" + tokens[1],
                text: `${tokens[1]} (${this.$t("filter.district")})`,
              });
              provinces.push({
                value: "province_" + tokens[2],
                text: `${tokens[2]} (${this.$t("filter.province")})`,
              });
              regions.push({
                value: "region_" + tokens[3],
                text: `${tokens[3]} (${this.$t("filter.region")})`,
              });
            });
            let arr = areaCodes
              .concat(districts)
              .concat(provinces)
              .concat(regions)
              .sort(this.sortByProperty("text"));
            this.filterValues.origins = Array.from(
              new Map(arr.map((item) => [item.value, item])).values()
            );
          }

          // devices
          if (this.defaultFilter.devices) {
            for (const deviceString of this.defaultFilter.devices) {
              const split = deviceString.split(",");
              const vendor = split[0];
              const model = split[1];
              const extension = split[2];
              const type = split[3];
              this.filterValues.devices[extension] = {
                vendor: vendor,
                model: model,
                type: type,
              };
            }
            this.$root.devices = this.filterValues.devices;
          }

          // save filter values to local storage (with expiry)
          this.saveToLocalStorageWithExpiry(
            this.reportFilterValuesStorageName,
            this.filterValues,
            this.FILTER_VALUES_TTL_MINUTES
          );

          // set selected values in filter
          this.setFilterSelection(this.defaultFilter, false);
          // retrieve phonebook after default filters
          this.retrievePhonebook();
        },
        (error) => {
          console.error(error.body);

          if (error.status == 404) {
            // filter values not present in cache, come back tomorrow
            this.$root.$emit("dataNotAvailable");
          }
        }
      );
    },
    setSearchInputs(filter) {
      // sources
      if (filter.sourcesUi.title) {
        this.$nextTick(() => {
          this.$refs.sourcesUi.$data.query = filter.sourcesUi.title;
        });
      }

      // destinations
      if (filter.destinationsUi.title) {
        this.$nextTick(() => {
          this.$refs.destinationsUi.$data.query = filter.destinationsUi.title;
        });
      }

      // duration
      if (filter.durationUi && filter.durationUi.title) {
        if (filter.durationUi.value) {
          // duration from options
          this.$nextTick(() => {
            this.$refs.duration.$data.query = filter.durationUi.title;
          });
        } else {
          this.$nextTick(() => {
            this.$refs.duration.$data.query =
              filter.durationUi.title + " " + this.$t("misc.seconds");
          });
        }
      }
    },
    setFilterSelection(filter, fromLocalStorage) {
      if (fromLocalStorage) {
        this.filter.queues = filter.queues;
        this.filter.agents = filter.agents;
        this.filter.reasons = filter.reasons;
        this.filter.results = filter.results;
        this.filter.ivrs = filter.ivrs;
        this.filter.choices = filter.choices;
        this.filter.origins = filter.origins;
        this.filter.caller = filter.caller;
        this.filter.contactName = filter.contactName;

        // cdr filters

        // sources, destinations, duration
        this.filter.sourcesUi = filter.sourcesUi;
        this.filter.destinationsUi = filter.destinationsUi;
        this.filter.durationUi = filter.durationUi;
        this.setSearchInputs(filter);

        this.filter.callType = filter.callType;
        this.filter.trunks = filter.trunks;
        this.filter.usersUi = filter.usersUi;
        this.filter.callDestinations = filter.callDestinations;
        this.filter.patterns = filter.patterns;
        this.filter.dids = filter.dids;
      }

      // time
      this.filter.time.range = filter.time.range;
      this.filter.time.cdrDashboardRange = filter.time.cdrDashboardRange;

      if (
        this.filter.time.range &&
        (!filter.time.interval.start || !filter.time.interval.end)
      ) {
        // set time interval from time range
        this.selectTime(this.filter.time.range);
      } else {
        this.filter.time.interval.start = this.moment(
          filter.time.interval.start
        ).toDate();
        this.filter.time.interval.end = this.moment(
          filter.time.interval.end
        ).toDate();
      }

      this.filter.time.group = filter.time.group;
      if (!this.showFilterTimeGroup || !this.filter.time.group) {
        this.filter.time.group = "day";
      }

      this.filter.time.division = filter.time.division;
      if (!this.showFilterTimeSplit || !this.filter.time.division) {
        this.filter.time.division = "60";
      }

      this.filter.geoGroup = filter.geoGroup;

      if (!fromLocalStorage) {
        // save filter to local storage
        this.set(this.reportFilterStorageName, this.filter);
      }

      this.loader.filter = false;
    },
    getSavedSearches(searchToSelect) {
      this.getSearches(
        this.currentReport,
        (success) => {
          const savedSearches = success.body.searches;
          if (!savedSearches) return

          this.mapSavedSearches(savedSearches);

          if (searchToSelect) {
            this.selectedSearch = searchToSelect;
            this.setFilterValuesFromSearch();
          }
        },
        (error) => {
          console.error(error.body);
        }
      );
    },
    mapSavedSearches(savedSearches) {
      let searchesMatchingView = [];
      let searchesNotMatchingView = [];

      for (const search of savedSearches) {
        search.value = search.name;
        search.text = search.name;

        if (
          search.section == this.$route.meta.section &&
          search.view == this.$route.meta.view
        ) {
          searchesMatchingView.push(search);
        } else {
          searchesNotMatchingView.push(search);
        }
      }
      this.savedSearches = searchesMatchingView.concat(searchesNotMatchingView);
    },
    setFilterValuesFromSearch() {
      // retrieve search object
      let search = this.savedSearches.find(
        (s) => s.name === this.selectedSearch
      );
      this.filter = this.prepareFilterForFrontend(search.filter);
    },
    selectTime(range) {
      this.errorTimeInterval = false;
      this.filter.time.range = range;

      if (range == "yesterday") {
        this.filter.time.interval = {
          start: this.getYesterday("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "last_two_days") {
        this.filter.time.interval = {
          start: this.getLastTwoDays("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "current_week") {
        this.filter.time.interval = {
          start: this.getCurrentWeek("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "last_seven_days") {
        this.filter.time.interval = {
          start: this.getLastSevenDays(),
          end: this.getYesterday("end"),
        };
      } else if (range == "last_week") {
        this.filter.time.interval = {
          start: this.getLastWeek("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "current_month") {
        this.filter.time.interval = {
          start: this.getCurrentMonth("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "last_three_months") {
        this.filter.time.interval = {
          start: this.getLastThreeMonths("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "current_year") {
        this.filter.time.interval = {
          start: this.getCurrentYear("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "last_two_weeks") {
        this.filter.time.interval = {
          start: this.getLastTwoWeeks("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "last_month") {
        this.filter.time.interval = {
          start: this.getLastMonth("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "last_two_months") {
        this.filter.time.interval = {
          start: this.getLastTwoMonths("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "last_six_months") {
        this.filter.time.interval = {
          start: this.getLastSixMonths("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "last_year") {
        this.filter.time.interval = {
          start: this.getLastYear("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "last_two_years") {
        this.filter.time.interval = {
          start: this.getLastTwoYears("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "last_three_years") {
        this.filter.time.interval = {
          start: this.getLastThreeYears("start"),
          end: this.getYesterday("end"),
        };
      } else if (range == "past_week") {
        this.filter.time.interval = {
          start: this.getPastPeriod("start", "isoWeek"),
          end: this.getPastPeriod("end", "isoWeek"),
        };
      } else if (range == "past_month") {
        this.filter.time.interval = {
          start: this.getPastPeriod("start", "month"),
          end: this.getPastPeriod("end", "month"),
        };
      } else if (range == "past_quarter") {
        this.filter.time.interval = {
          start: this.getPastPeriod("start", "quarter"),
          end: this.getPastPeriod("end", "month"),
        };
      } else if (range == "past_semester") {
        this.filter.time.interval = {
          start: this.getPastPeriod("start", "quarter", 2),
          end: this.getPastPeriod("end", "month"),
        };
      } else if (range == "past_year") {
        this.filter.time.interval = {
          start: this.getPastPeriod("start", "year"),
          end: this.getPastPeriod("end", "year"),
        };
      }
    },
    validateFilters() {
      const timeIntervalValid = this.validateTimeInterval();
      const callDurationValid = this.validateCallDuration();
      return timeIntervalValid && callDurationValid;
    },
    validateCallDuration() {
      if (!this.showFilterCdrCallDuration) {
        return true;
      }
      this.errorCallDuration = false;

      if (this.filter.durationUi.title && !this.filter.durationUi.value) {
        // validate custom call duration (free input)
        const syntaxValid = new RegExp("^[0-9]+$", "i").test(
          this.filter.durationUi.title
        );
        const syntaxValidWithUnit = new RegExp(
          "^[0-9]+ " + this.$t("misc.seconds") + "$",
          "i"
        ).test(this.filter.durationUi.title);

        if (!syntaxValid && !syntaxValidWithUnit) {
          this.errorCallDuration = true;
          return false;
        }
      }
      return true;
    },
    validateTimeInterval() {
      this.errorTimeInterval = false;

      // check time interval is not empty

      if (!this.filter.time.interval.start || !this.filter.time.interval.end) {
        this.errorTimeInterval = true;
        return false;
      }

      // check date format

      const dateFormat = this.getDateFormat();

      let formatStartValid = this.moment(
        this.filter.time.interval.start,
        dateFormat,
        true
      ).isValid();
      let formatEndValid = this.moment(
        this.filter.time.interval.end,
        dateFormat,
        true
      ).isValid();

      if (!formatStartValid || !formatEndValid) {
        this.errorTimeInterval = true;
        return false;
      }

      // check time interval start is not after time interval end

      const start = this.moment(this.filter.time.interval.start).format(
        dateFormat
      );
      const end = this.moment(this.filter.time.interval.end).format(dateFormat);

      if (this.moment(start).isAfter(this.moment(end))) {
        this.errorTimeInterval = true;
        return false;
      }
      return true;
    },
    clearHiddenFilters(filter) {
      if (!this.showFilterQueue) {
        filter.queues = [];
      }

      if (!this.showFilterAgent) {
        filter.agents = [];
      }

      if (!this.showFilterIvr) {
        filter.ivrs = [];
      }

      if (!this.showFilterReason) {
        filter.reasons = [];
      }

      if (!this.showFilterResult) {
        filter.results = [];
      }

      if (!this.showFilterChoice) {
        filter.choices = [];
      }

      if (!this.showFilterOrigin) {
        filter.origins = [];
      }

      if (!this.showFilterTimeGroup) {
        filter.time.group = "day";
      }

      if (!this.showFilterTimeSplit) {
        filter.time.division = "60";
      }

      if (!this.showFilterCaller) {
        filter.caller = "";
      }

      if (!this.showFilterCdrCaller) {
        filter.sources = [];
      }

      if (!this.showFilterCdrCallee) {
        filter.destinations = [];
      }

      if (!this.showFilterCdrCallType) {
        filter.callType = [];
      }

      if (!this.showFilterCdrCallDuration) {
        filter.duration = "";
      }

      if (!this.showFilterCdrTrunk) {
        filter.trunks = [];
      }

      if (!this.showFilterCdrDid) {
        filter.dids = [];
      }

      if (!this.showFilterCdrCallDestination) {
        filter.callDestinations = [];
      }

      if (!this.showFilterCdrDestination) {
        filter.patterns = [];
      }
      return filter;
    },
    prepareFilterForBackend() {
      let backendFilter = JSON.parse(JSON.stringify(this.filter));

      // retrieve contact name phones

      backendFilter.phones = [];

      if (this.filter.contactName) {
        const contact = this.$root.phonebook.find((c) => {
          return c.title == this.filter.contactName;
        });

        if (contact) {
          let phoneNumbers = [];

          for (const [phoneType, phoneList] of Object.entries(contact.phones)) {
            for (const phoneNumber of phoneList) {
              if (phoneNumber) {
                phoneNumbers.push(phoneType + "_" + phoneNumber);
              }
            }
          }

          if (phoneNumbers.length) {
            backendFilter.phones = phoneNumbers;
          }
        } else {
          // no contact found, clear searched contact name from filters
          this.filter.contactName = "";
        }
      }

      // format time interval

      if (backendFilter.time.interval) {
        const dateFormat = this.getDateFormat();
        backendFilter.time.interval.start = this.moment(
          backendFilter.time.interval.start
        ).format(dateFormat);
        backendFilter.time.interval.end = this.moment(
          backendFilter.time.interval.end
        ).format(dateFormat);
      }

      // call duration

      if (this.filter.durationUi.title) {
        if (this.filter.durationUi.value) {
          // chosen from options
          backendFilter.duration = this.filter.durationUi.value;
        } else {
          // custom call duration (free input)
          backendFilter.duration = this.filter.durationUi.title.replace(
            " " + this.$t("misc.seconds"),
            ""
          );
        }
      } else {
        // empty call duration
        backendFilter.duration = "";
      }

      // sources

      if (backendFilter.sourcesUi && backendFilter.sourcesUi.title) {
        backendFilter.sources = backendFilter.sourcesUi.value
          ? backendFilter.sourcesUi.value.split(",")
          : [backendFilter.sourcesUi.title];
      } else {
        backendFilter.sources = [];
      }

      // destinations

      if (backendFilter.destinationsUi && backendFilter.destinationsUi.title) {
        backendFilter.destinations = backendFilter.destinationsUi.value
          ? backendFilter.destinationsUi.value.split(",")
          : [backendFilter.destinationsUi.title];
      } else {
        backendFilter.destinations = [];
      }

      // users

      if (backendFilter.usersUi && backendFilter.usersUi.length) {
        let parsedUsers = [];
        backendFilter.usersUi.forEach((users) => {
          let userExt = users.split(",");
          parsedUsers = parsedUsers.concat(userExt);
        });
        backendFilter.users = parsedUsers;
      }

      backendFilter = this.clearHiddenFilters(backendFilter);
      return backendFilter;
    },
    prepareFilterForFrontend(backendFilter) {
      let frontendFilter = JSON.parse(JSON.stringify(backendFilter));

      // convert time interval from string

      const dateFormat = this.getDateFormat();
      frontendFilter.time.interval.start = this.moment(
        backendFilter.time.interval.start,
        dateFormat
      ).toDate();

      frontendFilter.time.interval.end = this.moment(
        backendFilter.time.interval.end,
        dateFormat
      ).toDate();

      // call duration

      if (backendFilter.durationUi.title) {
        if (backendFilter.durationUi.value) {
          // duration from options
          const optionFound = this.cdrCallDurationMap.find((d) => {
            return d.value == backendFilter.durationUi.value;
          });

          this.$refs.duration.$data.query = optionFound.title;
        } else {
          // custom call duration (free input)
          this.$refs.duration.$data.query =
            backendFilter.durationUi.title + " " + this.$t("misc.seconds");
        }
      } else {
        this.$refs.duration.$data.query = "";
      }

      // sources

      if (backendFilter.sourcesUi.title) {
        this.$refs.sourcesUi.$data.query = backendFilter.sourcesUi.title;
      } else {
        this.$refs.sourcesUi.$data.query = "";
      }

      // destinations

      if (backendFilter.destinationsUi.title) {
        this.$refs.destinationsUi.$data.query =
          backendFilter.destinationsUi.title;
      } else {
        this.$refs.destinationsUi.$data.query = "";
      }

      return frontendFilter;
    },
    applyFilters() {
      if (!this.validateFilters()) {
        return;
      }

      // time group
      if (!this.showFilterTimeGroup || !this.filter.time.group) {
        this.filter.time.group = "day";
      }

      // time split
      if (!this.showFilterTimeSplit || !this.filter.time.division) {
        this.filter.time.division = "60";
      }

      // save filter to local storage
      this.set(this.reportFilterStorageName, this.filter);

      let filterToApply = this.prepareFilterForBackend();

      // apply filters
      this.$root.$emit("applyFilters", filterToApply);
    },
    showSaveSearchModal(value) {
      this.newSearchName = "";
      this.errorMessage = "";
      this.errorNewSearch = false;
      this.openSaveSearchModal = value;
    },
    showOverwriteSearchModal(value) {
      this.openOverwriteSearchModal = value;
    },
    validateSaveNewSearch() {
      this.errorNewSearch = false;
      this.errorMessage = "";

      if (!this.newSearchName) {
        this.errorNewSearch = true;
        this.errorMessage = this.$i18n.t("message.search_name_required");
        return;
      }

      let exists = this.savedSearches.find(
        (s) => s.name === this.newSearchName
      );

      if (exists) {
        this.errorNewSearch = true;
        this.errorMessage = this.$i18n.t("message.search_name_already_exist");
        return;
      }

      if (!/^[a-zA-Z][a-zA-Z0-9 \-,]+$/.test(this.newSearchName)) {
        this.errorNewSearch = true;
        this.errorMessage = this.$i18n.t("message.search_name_validation");
        return;
      }
      this.saveSearch(this.newSearchName);
    },
    saveSearch(searchName) {
      this.loader.saveSearch = true;
      let filterToSave = this.prepareFilterForBackend();

      const search = this.savedSearches.find((s) => s.name === searchName);

      this.createSearch(
        this.currentReport,
        {
          name: searchName,
          section: search ? search.section : this.$route.meta.section,
          view: search ? search.view : this.$route.meta.view,
          filter: filterToSave,
        },
        () => {
          this.loader.saveSearch = false;
          this.showSaveSearchModal(false);
          this.showOverwriteSearchModal(false);
          this.getSavedSearches(searchName);
        },
        (error) => {
          this.loader.saveSearch = false;
          console.error(error.body);
        }
      );
    },
    showDeleteSearchModal(value) {
      this.openDeleteSearchModal = value;
    },
    deleteSelectedSearch() {
      this.loader.deleteSearch = true;

      const search = this.savedSearches.find(
        (s) => s.name === this.selectedSearch
      );

      // search key is: search_REPORT_SECTION_VIEW_NAME
      const searchId =
        "search_" +
        this.currentReport +
        "_" +
        search.section +
        "_" +
        search.view +
        "_" +
        search.name;

      this.deleteSearch(
        this.currentReport,
        searchId,
        () => {
          this.loader.deleteSearch = false;
          this.showDeleteSearchModal(false);
          this.selectedSearch = null;
          this.getSavedSearches();
        },
        (error) => {
          this.loader.deleteSearch = false;
          console.error(error.body);
        }
      );
    },
    updateIvrChoices() {
      if (!this.filter.ivrs) {
        return;
      }

      // show only IVR choices related to selected IVRs
      let selectedIvrs = this.filter.ivrs;

      if (this.filter.ivrs.length == 0) {
        // selecting no IVR is the same as selecting all of them
        selectedIvrs = this.filterValues.ivrs.map((ivr) => {
          return ivr.value;
        });
      }

      let relatedChoiceValues = new Set();

      selectedIvrs.forEach((selectedIvr) => {
        const ivr = this.filterValues.ivrs.find((i) => {
          return i.value == selectedIvr;
        });

        // find related IVR choices
        let relatedChoices = this.filterValues.allChoices.filter((choice) => {
          return choice.idIvr == ivr.id;
        });

        // add to set to avoid duplicates in choices dropdown
        relatedChoices.forEach((choice) => {
          relatedChoiceValues.add(choice.value);
        });
      });

      // create array of objects for choices dropdow
      let choices = Array.from(relatedChoiceValues).map((choiceName) => {
        return { value: choiceName, text: choiceName };
      });
      this.filterValues.choices = choices.sort(this.sortByProperty("text"));
    },
    async retrievePhonebook() {
      this.phonebookDb = await this.getDb(
        this.PHONEBOOK_DB_NAME,
        this.PHONEBOOK_DB_VERSION
      );
      let phonebookExpiry = this.get("reportPhonebookExpiry");

      if (phonebookExpiry && new Date().getTime() < phonebookExpiry) {
        // get phonebook from indexed db
        const phonebook = await this.readFromDb(
          this.phonebookDb,
          this.PHONEBOOK_DB_NAME
        );
        this.$root.phonebook = phonebook[0].phonebook;
        // function to add phonebook contacts to filters
        this.addToCallerAndCalleeFilters();
        this.phonebookReady = true;
      } else {
        await this.clearDb(this.phonebookDb, this.PHONEBOOK_DB_NAME);

        // get phonebook from backend
        this.getPhonebook(
          async (success) => {
            let phonebook = [];

            for (const [contactName, contactPhones] of Object.entries(
              success.body
            )) {
              // extract company
              let company = "";
              const match = /[^|]+\| (.+)/.exec(contactName);
              if (match && match[1]) {
                company = match[1];
              }

              const cleanName = contactName
                .replace(/[^a-zA-Z0-9]/g, "")
                .toLowerCase();

              phonebook.push({
                title: contactName,
                phones: contactPhones,
                cleanName: cleanName,
                company: company,
              });
            }
            await this.addToDb(
              { phonebook: phonebook },
              this.phonebookDb,
              this.PHONEBOOK_DB_NAME
            );

            // save phonebook expiry to local storage
            const expiry =
              new Date().getTime() + this.PHONEBOOK_TTL_MINUTES * 60 * 1000;
            this.set("reportPhonebookExpiry", expiry);

            this.$root.phonebook = phonebook;
            // function to add phonebook contacts to filters
            this.addToCallerAndCalleeFilters();
            this.phonebookReady = true;
          },
          (error) => {
            console.error(error.body);
          }
        );
      }
    },
    contactNameInput() {
      // get clean name from user input
      const queryText = this.filter.contactName.replace(/[^a-zA-Z0-9]/g, "");

      if (queryText.length < 3) {
        this.searchContactResults = [];
        this.showSearchResults = false;
        return;
      }

      // search contact name in phonebook
      this.searchContactResults = this.$root.phonebook.filter((contact) => {
        // compare query text with contact clean name
        return new RegExp(queryText, "i").test(contact.cleanName);
      });

      if (this.searchContactResults.length) {
        this.showSearchResults = true;
      } else {
        this.showSearchResults = false;
      }
    },
    contactNameFocus() {
      if (this.searchContactResults.length) {
        this.showSearchResults = true;
      }
    },
    contactNameBlur() {
      setTimeout(() => {
        this.showSearchResults = false;
      }, 300);
    },
    selectContact(contact) {
      this.filter.contactName = contact.title;
      this.showSearchResults = false;
    },
    clearFilters() {
      this.filter.queues = [];
      this.filter.groups = [];
      this.filter.agents = [];
      this.filter.ivrs = [];
      this.filter.reasons = [];
      this.filter.results = [];
      this.filter.choices = [];
      this.filter.destinationsUi = {};
      this.$refs.destinationsUi.$data.query = "";
      this.filter.origins = [];
      this.filter.caller = "";
      this.filter.contactName = "";
      this.filter.callType = [];
      this.filter.durationUi = {};
      this.$refs.duration.$data.query = "";
      this.filter.sourcesUi = {};
      this.$refs.sourcesUi.$data.query = "";
      this.filter.trunks = [];
      this.filter.usersUi = [];
      this.filter.callDestinations = [];
      this.filter.patterns = [];
      this.filter.dids = [];
      this.applyFilters();
    },
    onSourcesInput(value) {
      this.filter.sourcesUi = { title: value };
    },
    onSourcesSelect(searchResult) {
      this.filter.sourcesUi = searchResult;
    },
    onDestinationsInput(value) {
      this.filter.destinationsUi = { title: value };
    },
    onDestinationsSelect(searchResult) {
      this.filter.destinationsUi = searchResult;
    },
    onDurationInput(value) {
      this.filter.durationUi = { title: value };
    },
    onDurationSelect(searchResult) {
      this.filter.durationUi = searchResult;
    },
    retrieveCallerCalleeDoc() {
      try {
        let doc = require("../doc-inline/" +
          this.$root.currentLocale +
          "/caller_callee.md");
        this.callerCalleeDoc = doc.default;
      } catch (error) {
        this.callerCalleeDoc = "";
      }
    },
  },
  computed: {
    showFilterTime: function () {
      return this.isFilterInView("time", this.filtersMap);
    },
    showFilterTimeGroup: function () {
      return this.isFilterInView("timeGroup", this.filtersMap);
    },
    showFilterTimeSplit: function () {
      return this.isFilterInView("timeSplit", this.filtersMap);
    },
    showFilterTimeHour: function () {
      return this.isFilterInView("hour", this.filtersMap);
    },
    showFilterAgent: function () {
      return this.isFilterInView("agent", this.filtersMap);
    },
    showFilterQueue: function () {
      return this.isFilterInView("queue", this.filtersMap);
    },
    showFilterReason: function () {
      return this.isFilterInView("reason", this.filtersMap);
    },
    showFilterResult: function () {
      return this.isFilterInView("result", this.filtersMap);
    },
    showFilterIvr: function () {
      return this.isFilterInView("ivr", this.filtersMap);
    },
    showFilterChoice: function () {
      return this.isFilterInView("choice", this.filtersMap);
    },
    showFilterOrigin: function () {
      return this.isFilterInView("origin", this.filtersMap);
    },
    showFilterCaller: function () {
      return this.isFilterInView("caller", this.filtersMap);
    },
    showFilterContactName: function () {
      return this.isFilterInView("contactName", this.filtersMap);
    },
    // cdr filters check
    showFilterCdrTimeRange: function () {
      return this.isFilterInView("cdr_timeRange", this.filtersMap);
    },
    showFilterCdrDashboardTimeRange: function () {
      return this.isFilterInView("cdr_dashboardTimeRange", this.filtersMap);
    },
    // cdr caller check
    showFilterCdrCaller: function () {
      return this.isFilterInView("cdr_caller", this.filtersMap);
    },
    // cdr callee check
    showFilterCdrCallee: function () {
      return this.isFilterInView("cdr_callee", this.filtersMap);
    },
    // cdr callee check
    showFilterCdrCallType: function () {
      return this.isFilterInView("cdr_callType", this.filtersMap);
    },
    // cdr callee check
    showFilterCdrCallDuration: function () {
      return this.isFilterInView("cdr_callDuration", this.filtersMap);
    },
    // cdr trunk check
    showFilterCdrTrunk: function () {
      return this.isFilterInView("cdr_trunk", this.filtersMap);
    },
    // cdr did check
    showFilterCdrDid: function () {
      return this.isFilterInView("cdr_did", this.filtersMap);
    },
    // cdr destination type
    showFilterCdrCallDestination: function () {
      return this.isFilterInView("cdr_callDestination", this.filtersMap);
    },
    // cdr destination
    showFilterCdrDestination: function () {
      return this.isFilterInView("cdr_destination", this.filtersMap);
    },
    showFilterGeoGroup: function () {
      return this.isFilterInView("geoGroup", this.filtersMap);
    },
    reportFilterStorageName: function () {
      return "reportFilter-" + this.get("loggedUser").username;
    },
    reportFilterValuesStorageName: function () {
      return "reportFilterValues-" + this.get("loggedUser").username;
    },
    filtersReady: function () {
      return !this.loader.filter && this.phonebookReady;
    },
    agentsFilteredByQueue: function () {
      if (!this.filter.queues.length) {
        // no queue selected
        return this.filterValues.agents;
      } else {
        // show only agents of selected queues
        let agentsFilteredByQueue = [];

        this.filter.queues.forEach((queue) => {
          agentsFilteredByQueue = agentsFilteredByQueue.concat(this.filterValues.queueAgentsMap[queue]);
        });

        return agentsFilteredByQueue.sort(this.sortByProperty("text"));
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../styles/filters.scss";
</style>
