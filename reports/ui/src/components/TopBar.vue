<template>
  <div class="masthead topbar">
    <sui-container class="align-left">
      <sui-menu floated="right">
        <sui-dropdown
          class="item top floating pointing"
          icon="paint brush no-margin"
        >
          <sui-dropdown-menu class="color-scheme">
            <sui-dropdown-item
              v-for="(colorScheme, index) in colorSchemes"
              v-bind:key="index"
              @click="setColorScheme(colorScheme)"
            >
              <span
                v-for="n in 8"
                v-bind:key="n"
                class="color-sample"
                :style="{ backgroundColor: colors[colorScheme][n - 1] }"
              ></span>
              <sui-icon v-if="colorScheme == $root.colorScheme" name="check" />
            </sui-dropdown-item>
          </sui-dropdown-menu>
        </sui-dropdown>
        <sui-popup
          v-if="isAdmin"
          position="bottom center"
          :content="$t('menu.settings')"
        >
          <a
            slot="trigger"
            is="sui-menu-item"
            icon="cog"
            @click="showSettingsModal(true)"
          />
        </sui-popup>
        <sui-popup position="bottom center" :content="$t('menu.logout')">
          <a
            @click="doLogout()"
            slot="trigger"
            is="sui-menu-item"
            icon="sign-out"
          />
        </sui-popup>
      </sui-menu>
      <sui-menu floated="right">
        <sui-popup
          position="bottom center"
          class="labeled icon"
          v-bind:content="
            showFilters ? $t('menu.hide_filters') : $t('menu.show_filters')
          "
        >
          <a
            slot="trigger"
            is="sui-menu-item"
            v-on:click="toggleFilters()"
            class="filter-button"
            :active="showFilters"
            :disabled="!((dataAvailable && $route.meta.report == 'queue') || (cdrDataAvailable && $route.meta.report == 'cdr'))"
            :content="$t('menu.filters')"
            icon="filter"
          />
        </sui-popup>
      </sui-menu>
      <h1 is="sui-header" class="view-title">
        {{ title }}
      </h1>
      <span v-if="viewDoc">
        <sui-popup flowing hoverable position="bottom center">
          <div class="doc-info markdown">
            <VueShowdown :markdown="viewDoc"></VueShowdown>
          </div>
          <sui-icon name="info circle" class="doc-info-icon doc-info-view-title" slot="trigger" />
        </sui-popup>
      </span>
    </sui-container>
    <Filters :showFiltersForm="showFilters" />

    <!-- settings modal -->
    <sui-form :error="adminSettingsError">
      <sui-modal v-model="openSettingsModal">
        <sui-modal-header>{{ $t("menu.settings") }}</sui-modal-header>
        <sui-modal-content scrolling>
          <sui-modal-description>
            <sui-header>{{ $t("settings.general") }}</sui-header>
            <!-- office hours -->
            <sui-form-fields>
              <sui-form-field :error="error.settings.officeHourStart != ''">
                <label>{{ $t("settings.office_hours_start") }}</label>
                <vue-timepicker
                  hide-clear-button
                  :minute-interval="5"
                  v-model="adminSettings.officeHourStart"
                  ref="officeHourStart"
                ></vue-timepicker>
              </sui-form-field>
              <sui-form-field :error="error.settings.officeHourEnd != ''">
                <label>{{ $t("settings.office_hours_end") }}</label>
                <vue-timepicker
                  hide-clear-button
                  :minute-interval="5"
                  v-model="adminSettings.officeHourEnd"
                  ref="officeHourEnd"
                ></vue-timepicker>
              </sui-form-field>
            </sui-form-fields>
            <sui-message
              v-show="
                error.settings.officeHourStart || error.settings.officeHourEnd
              "
              error
            >
              <p>{{ $t("validation.office_hours_invalid") }}</p>
            </sui-message>
            <div class="settings-description">
              {{ $t("message.office_hours_description") }}
            </div>
            <!-- query limit -->
            <sui-form-fields>
              <sui-form-field
                width="three"
                :error="error.settings.queryLimit != ''"
              >
                <label>{{ $t("settings.query_limit") }}</label>
                <sui-input
                  v-model.number="adminSettings.queryLimit"
                  type="number"
                  min="10"
                  ref="queryLimit"
                />
              </sui-form-field>
            </sui-form-fields>
            <sui-message v-show="error.settings.queryLimit" error>
              <p>{{ $t("validation." + error.settings.queryLimit) }}</p>
            </sui-message>
            <div class="settings-description">
              {{ $t("message.query_limit_description") }}
            </div>
            <!-- null call time -->
            <sui-form-fields>
              <sui-form-field
                width="three"
                :error="error.settings.nullCallTime != ''"
              >
                <label>{{ $t("settings.null_call") }}</label>
                <sui-input
                  v-model.number="adminSettings.nullCallTime"
                  type="number"
                  min="0"
                  ref="nullCallTime"
                />
              </sui-form-field>
            </sui-form-fields>
            <sui-message v-show="error.settings.nullCallTime" error>
              <p>{{ $t("validation." + error.settings.nullCallTime) }}</p>
            </sui-message>
            <div class="settings-description">
              {{ $t("message.null_call_description") }}
            </div>
            <!-- currency -->
            <sui-form-fields>
              <sui-form-field
                width="three"
                :error="error.settings.currency != ''"
              >
                <label>{{ $t("settings.currency") }}</label>
                <sui-input
                  v-model.trim="adminSettings.currency"
                  ref="currency"
                />
              </sui-form-field>
            </sui-form-fields>
            <sui-message v-show="error.settings.currency" error>
              <p>{{ $t("validation." + error.settings.currency) }}</p>
            </sui-message>
            <div class="settings-description">
              {{ $t("message.currency_description") }}
            </div>
            <!-- destinations -->
            <sui-header>
              {{ $t("settings.destinations") }}
              <span>
                <sui-popup
                  :content="$t('message.configure_to_compute_call_costs')"
                >
                  <sui-icon
                    v-show="highlightCostsSettings"
                    name="exclamation circle"
                    color="blue"
                    class="blink-opacity blink-icon"
                    slot="trigger"
                  />
                </sui-popup>
              </span>
            </sui-header>
            <div class="settings-description">
              {{ $t("message.destinations_description") }}
            </div>
            <sui-card-group :items-per-row="3">
              <sui-card
                v-for="(destination, index) in adminSettings.destinations"
                v-bind:key="'destination-' + index"
                class="destination"
              >
                <sui-card-content>
                  <sui-icon
                    name="map marker alternate"
                    class="right floated no-mg"
                    size="large"
                  />
                  <sui-card-header>{{ destination }}</sui-card-header>
                  <span v-show="destination == destinationJustCreated">
                    <sui-popup :content="$t('misc.just_created')">
                      <sui-icon
                        name="check circle"
                        color="green"
                        size="large"
                        class="created-icon"
                        slot="trigger"
                      />
                    </sui-popup>
                  </span>
                </sui-card-content>
                <sui-button
                  v-if="adminSettings.destinations.length > 1"
                  basic
                  negative
                  attached="bottom"
                  type="button"
                  @click="showDeleteDestinationModal(destination)"
                >
                  <sui-icon name="trash" /> {{ $t("command.delete") }}
                </sui-button>
              </sui-card>
              <!-- new destination -->
              <sui-card class="destination">
                <sui-card-content>
                  <sui-icon
                    name="map marker alternate"
                    class="right floated no-mg"
                    size="large"
                  />
                  <sui-input
                    v-model.trim="newDestination"
                    :placeholder="$t('settings.new_destination')"
                    ref="newDestination"
                    :class="{
                      'input-error': error.settings.newDestination,
                    }"
                  />
                </sui-card-content>
                <sui-button
                  basic
                  positive
                  attached="bottom"
                  type="button"
                  @click="createDestination()"
                >
                  <sui-icon name="plus" /> {{ $t("command.create") }}
                </sui-button>
              </sui-card>
            </sui-card-group>
            <!-- call patterns -->
            <sui-accordion exclusive class="call-patterns-accordion">
              <sui-accordion-title>
                <sui-icon name="dropdown" />
                <a>
                  {{ $t("settings.call_patterns_accordion") }}
                  <span>
                    <sui-popup
                      :content="$t('message.configure_to_compute_call_costs')"
                    >
                      <sui-icon
                        v-show="highlightCostsSettings"
                        name="exclamation circle"
                        color="blue"
                        class="blink-opacity blink-icon"
                        slot="trigger"
                      />
                    </sui-popup>
                  </span>
                </a>
              </sui-accordion-title>
              <sui-accordion-content>
                <div class="settings-description no-mg-top">
                  {{ $t("message.call_patterns_description") }}
                </div>
                <sui-form-fields
                  v-for="(callPattern, index) in adminSettings.callPatterns"
                  v-bind:key="'callPattern' + index"
                >
                  <sui-form-field width="three">
                    <label>{{ $t("settings.prefix") }}</label>
                    <sui-input v-model.trim="callPattern.prefix" disabled />
                  </sui-form-field>
                  <sui-form-field width="five">
                    <label>{{ $t("settings.destination") }}</label>
                    <sui-dropdown
                      :placeholder="$t('settings.destination')"
                      search
                      selection
                      v-model="callPattern.destination"
                      :options="destinationOptions"
                      disabled
                    />
                  </sui-form-field>
                  <sui-form-field>
                    <label class="color-transparent">.</label>
                    <sui-button
                      v-if="adminSettings.callPatterns.length > 1"
                      basic
                      negative
                      type="button"
                      @click="showDeleteCallPatternModal(callPattern)"
                    >
                      <sui-icon name="trash" /> {{ $t("command.delete") }}
                    </sui-button>
                  </sui-form-field>
                  <sui-form-field>
                    <label class="color-transparent">.</label>
                    <span
                      v-show="
                        callPattern.prefix == callPatternJustCreated.prefix
                      "
                    >
                      <sui-popup :content="$t('misc.just_created')">
                        <sui-icon
                          name="check circle"
                          color="green"
                          size="large"
                          class="created-icon"
                          slot="trigger"
                        />
                      </sui-popup>
                    </span>
                  </sui-form-field>
                </sui-form-fields>
                <!-- new call pattern -->
                <sui-form-fields>
                  <sui-form-field
                    width="three"
                    :error="error.settings.newCallPatternPrefix != ''"
                  >
                    <label>{{ $t("settings.prefix") }}</label>
                    <sui-input
                      v-model.trim="newCallPattern.prefix"
                      :placeholder="$t('settings.new_prefix')"
                      ref="newCallPatternPrefix"
                    />
                  </sui-form-field>
                  <sui-form-field
                    width="five"
                    :error="error.settings.newCallPatternDestination != ''"
                  >
                    <label>{{ $t("settings.destination") }}</label>
                    <sui-dropdown
                      :placeholder="$t('settings.destination')"
                      search
                      selection
                      v-model="newCallPattern.destination"
                      :options="destinationOptions"
                      ref="newCallPatternDestination"
                    />
                  </sui-form-field>
                  <sui-form-field>
                    <label class="color-transparent">.</label>
                    <sui-button
                      basic
                      positive
                      type="button"
                      @click="createCallPattern()"
                    >
                      <sui-icon name="plus" /> {{ $t("command.create") }}
                    </sui-button>
                  </sui-form-field>
                </sui-form-fields>
                <sui-message v-show="error.settings.newCallPatternPrefix" error>
                  <p>
                    {{
                      $t("validation." + error.settings.newCallPatternPrefix)
                    }}
                  </p>
                </sui-message>
                <sui-message
                  v-show="error.settings.newCallPatternDestination"
                  error
                >
                  <p>
                    {{
                      $t(
                        "validation." + error.settings.newCallPatternDestination
                      )
                    }}
                  </p>
                </sui-message>
              </sui-accordion-content>
            </sui-accordion>
            <!-- costs -->
            <sui-header>
              {{ $t("settings.costs") }}
              <span>
                <sui-popup
                  :content="$t('message.configure_to_compute_call_costs')"
                >
                  <sui-icon
                    v-show="highlightCostsSettings"
                    name="exclamation circle"
                    color="blue"
                    class="blink-opacity blink-icon"
                    slot="trigger"
                  />
                </sui-popup>
              </span>
            </sui-header>
            <div class="settings-description">
              {{ $t("message.costs_description") }}
            </div>
            <sui-form-fields
              v-for="(cost, index) in adminSettings.costs"
              v-bind:key="'cost-' + index"
            >
              <sui-form-field width="four">
                <label>{{ $t("settings.trunk") }}</label>
                <sui-dropdown
                  :placeholder="$t('settings.trunk')"
                  search
                  selection
                  v-model="cost.channelId"
                  :options="trunkOptions"
                  disabled
                />
              </sui-form-field>
              <sui-form-field width="four">
                <label>{{ $t("settings.destination") }}</label>
                <sui-dropdown
                  :placeholder="$t('settings.destination')"
                  search
                  selection
                  v-model="cost.destination"
                  :options="destinationOptions"
                  disabled
                />
              </sui-form-field>
              <sui-form-field>
                <label>{{
                  $t("settings.cost") +
                  " (" +
                  adminSettings.currency +
                  " " +
                  $t("misc.per_minute") +
                  ")"
                }}</label>
                <input
                  type="number"
                  v-model.number="cost.cost"
                  min="0"
                  step=".01"
                  :placeholder="
                    adminSettings.currency + ' ' + $t('misc.per_minute')
                  "
                  disabled
                />
              </sui-form-field>
              <sui-form-field>
                <label class="color-transparent">.</label>
                <sui-button
                  basic
                  negative
                  type="button"
                  @click="showDeleteCostModal(cost)"
                >
                  <sui-icon name="trash" /> {{ $t("command.delete") }}
                </sui-button>
              </sui-form-field>
              <sui-form-field>
                <label class="color-transparent">.</label>
                <span
                  v-show="
                    cost.channelId == costJustCreated.channelId &&
                    cost.destination == costJustCreated.destination
                  "
                >
                  <sui-popup :content="$t('misc.just_created')">
                    <sui-icon
                      name="check circle"
                      color="green"
                      size="large"
                      class="created-icon"
                      slot="trigger"
                    />
                  </sui-popup>
                </span>
              </sui-form-field>
            </sui-form-fields>
            <!-- new cost -->
            <sui-form-fields>
              <sui-form-field
                width="four"
                :error="error.settings.newCostChannelId != ''"
              >
                <label>{{ $t("settings.trunk") }}</label>
                <sui-dropdown
                  :placeholder="$t('settings.trunk')"
                  search
                  selection
                  v-model="newCost.channelId"
                  :options="trunkOptions"
                  direction="upward"
                  ref="newCostChannelId"
                />
              </sui-form-field>
              <sui-form-field
                width="four"
                :error="error.settings.newCostDestination != ''"
              >
                <label>{{ $t("settings.destination") }}</label>
                <sui-dropdown
                  :placeholder="$t('settings.destination')"
                  search
                  selection
                  v-model="newCost.destination"
                  :options="destinationOptions"
                  direction="upward"
                  ref="newCostDestination"
                />
              </sui-form-field>
              <sui-form-field :error="error.settings.newCostValue != ''">
                <label>{{
                  $t("settings.cost") +
                  " (" +
                  adminSettings.currency +
                  " " +
                  $t("misc.per_minute") +
                  ")"
                }}</label>
                <input
                  type="number"
                  v-model.number="newCost.cost"
                  min="0"
                  step=".01"
                  :placeholder="
                    adminSettings.currency + ' ' + $t('misc.per_minute')
                  "
                  ref="newCostValue"
                />
              </sui-form-field>
              <sui-form-field width="three">
                <label class="color-transparent">.</label>
                <sui-button basic positive type="button" @click="createCost()">
                  <sui-icon name="plus" /> {{ $t("command.create") }}
                </sui-button>
              </sui-form-field>
            </sui-form-fields>
            <sui-message v-if="error.settings.newCostChannelId == 'cost_duplicated' && error.settings.newCostDestination == 'cost_duplicated'" error>
              <p>{{ $t("validation.cost_duplicated") }}</p>
            </sui-message>
            <template v-else>
              <sui-message v-show="error.settings.newCostChannelId" error>
                <p>{{ $t("validation." + error.settings.newCostChannelId) }}</p>
              </sui-message>
              <sui-message v-show="error.settings.newCostDestination" error>
                <p>{{ $t("validation." + error.settings.newCostDestination) }}</p>
              </sui-message>
              <sui-message v-show="error.settings.newCostValue" error>
                <p>{{ $t("validation." + error.settings.newCostValue) }}</p>
              </sui-message>
            </template>
            <!-- reset admin settings -->
            <sui-header>
              {{ $t("settings.reset_settings") }}
            </sui-header>
            <div class="settings-description">
              {{ $t("message.reset_settings_description") }}
            </div>
            <sui-form-fields>
              <sui-form-field>
                <sui-button
                  negative
                  type="button"
                  icon="trash"
                  :content="$t('command.reset_settings')"
                  @click="showResetSettingsModal()"
                ></sui-button>
              </sui-form-field>
            </sui-form-fields>
          </sui-modal-description>
        </sui-modal-content>
        <sui-modal-actions>
          <sui-button type="button" @click.native="showSettingsModal(false)">{{
            $t("command.cancel")
          }}</sui-button>
          <sui-button
            primary
            type="button"
            icon="save"
            :loading="loader.saveSettings"
            :content="$t('command.save')"
            @click="saveAdminSettings()"
          ></sui-button>
        </sui-modal-actions>
      </sui-modal>
    </sui-form>

    <!-- configure costs modal -->
    <sui-form>
      <sui-modal v-model="openCostsConfigModal" size="tiny">
        <sui-modal-header>{{ $t("message.welcome_in_cdr") }}</sui-modal-header>
        <sui-modal-content>
          <sui-modal-description>
            <sui-header>{{ $t("message.configure_call_costs") }}</sui-header>
            <p>
              {{ $t("message.configure_call_costs_description") }}
            </p>
          </sui-modal-description>
        </sui-modal-content>
        <sui-modal-actions>
          <sui-button type="button" @click.native="skipCostsConfiguration">{{
            $t("command.skip")
          }}</sui-button>
          <sui-button
            primary
            type="button"
            :content="$t('command.configure')"
            @click="configureCosts()"
          ></sui-button>
        </sui-modal-actions>
      </sui-modal>
    </sui-form>

    <!-- delete destination modal -->
    <sui-form warning>
      <sui-modal v-model="openDeleteDestinationModal" size="tiny">
        <sui-modal-header>{{
          $t("command.delete_destination")
        }}</sui-modal-header>
        <sui-modal-content>
          <sui-modal-description>
            <sui-message warning>
              <i class="exclamation triangle icon"></i>
              {{ $t("message.you_are_about_to_delete") }}
              <b>{{ destinationToDelete }}</b>
            </sui-message>
            <p>{{ $t("message.are_you_sure") }}</p>
          </sui-modal-description>
        </sui-modal-content>
        <sui-modal-actions>
          <sui-button
            type="button"
            @click.native="hideDeleteDestinationModal()"
            >{{ $t("command.cancel") }}</sui-button
          >
          <sui-button
            negative
            type="button"
            :loading="loader.deleteDestination"
            :content="$t('command.delete')"
            @click="deleteDestination()"
          ></sui-button>
        </sui-modal-actions>
      </sui-modal>
    </sui-form>

    <!-- delete call pattern modal -->
    <sui-form warning>
      <sui-modal v-model="openDeleteCallPatternModal" size="tiny">
        <sui-modal-header>{{
          $t("command.delete_call_pattern")
        }}</sui-modal-header>
        <sui-modal-content>
          <sui-modal-description>
            <sui-message warning>
              <i class="exclamation triangle icon"></i>
              {{ $t("message.you_are_about_to_delete") }}
              <b>{{ callPatternToDelete.prefix }}</b>
            </sui-message>
            <p>{{ $t("message.are_you_sure") }}</p>
          </sui-modal-description>
        </sui-modal-content>
        <sui-modal-actions>
          <sui-button
            type="button"
            @click.native="hideDeleteCallPatternModal()"
            >{{ $t("command.cancel") }}</sui-button
          >
          <sui-button
            negative
            type="button"
            :loading="loader.deleteCallPattern"
            :content="$t('command.delete')"
            @click="deleteCallPattern()"
          ></sui-button>
        </sui-modal-actions>
      </sui-modal>
    </sui-form>

    <!-- delete cost modal -->
    <sui-form warning>
      <sui-modal v-model="openDeleteCostModal" size="tiny">
        <sui-modal-header>{{ $t("command.delete_cost") }}</sui-modal-header>
        <sui-modal-content>
          <sui-modal-description>
            <sui-message warning>
              <i class="exclamation triangle icon"></i>
              {{ $t("message.you_are_about_to_delete") }}
              {{ $t("settings.cost") }}
              <b
                >{{ costToDelete.channelId }}, {{ costToDelete.destination }}</b
              >
            </sui-message>
            <p>{{ $t("message.are_you_sure") }}</p>
          </sui-modal-description>
        </sui-modal-content>
        <sui-modal-actions>
          <sui-button type="button" @click.native="hideDeleteCostModal()">{{
            $t("command.cancel")
          }}</sui-button>
          <sui-button
            negative
            type="button"
            :loading="loader.deleteCost"
            :content="$t('command.delete')"
            @click="deleteCost()"
          ></sui-button>
        </sui-modal-actions>
      </sui-modal>
    </sui-form>

    <!-- reset settings modal -->
    <sui-form warning>
      <sui-modal v-model="openResetSettingsModal" size="tiny">
        <sui-modal-header>{{ $t("command.reset_settings") }}</sui-modal-header>
        <sui-modal-content>
          <sui-modal-description>
            <sui-message warning>
              <i class="exclamation triangle icon"></i>
              {{ $t("message.you_are_about_to_reset_settings") }}
            </sui-message>
            <p>{{ $t("message.are_you_sure") }}</p>
          </sui-modal-description>
        </sui-modal-content>
        <sui-modal-actions>
          <sui-button type="button" @click.native="hideResetSettingsModal()">{{
            $t("command.cancel")
          }}</sui-button>
          <sui-button
            negative
            type="button"
            icon="trash"
            :loading="loader.resetSettings"
            :content="$t('command.reset_settings')"
            @click="resetAdminSettings()"
          ></sui-button>
        </sui-modal-actions>
      </sui-modal>
    </sui-form>
  </div>
</template>

<script>
import Filters from "./Filters.vue";
import LoginService from "../services/login";
import StorageService from "../services/storage";
import VueTimepicker from "vue2-timepicker";
import "vue2-timepicker/dist/VueTimepicker.css";
import SettingsService from "../services/settings";
import FilterService from "../services/filter";

export default {
  name: "TopBar",
  components: {
    Filters: Filters,
    VueTimepicker,
  },
  mixins: [LoginService, StorageService, SettingsService, FilterService],
  data() {
    return {
      showFilters: true,
      title: this.$i18n.t(this.$route.meta.name) || "",
      openSettingsModal: false,
      adminSettings: {
        officeHourStart: "",
        officeHourEnd: "",
        queryLimit: 0,
        nullCallTime: 0,
        destinations: [],
        callPatterns: [],
        costs: [],
      },
      trunks: [],
      openCostsConfigModal: false,
      isAdmin: false,
      dataAvailable: true,
      cdrDataAvailable: true,
      newDestination: "",
      openDeleteDestinationModal: false,
      destinationToDelete: "",
      destinationOptions: [],
      newCallPattern: {
        prefix: "",
        destination: null,
      },
      callPatternToDelete: {
        prefix: "",
        destination: null,
      },
      openDeleteCallPatternModal: false,
      trunkOptions: [],
      newCost: {
        channelId: null,
        destination: null,
        cost: "",
      },
      costToDelete: {
        channelId: null,
        destination: null,
        cost: "",
      },
      openDeleteCostModal: false,
      highlightCostsSettings: false,
      openResetSettingsModal: false,
      destinationJustCreated: "",
      callPatternJustCreated: {
        prefix: "",
        destination: null,
      },
      costJustCreated: {
        channelId: null,
        destination: null,
        cost: "",
      },
      colorSchemes: [
        "tableau.Classic10",
        "brewer.DarkTwo8",
        "brewer.SetOne8",
        "tableau.MillerStone11",
        "brewer.Accent8",
        "tableau.GreenOrangeTeal12",
        "brewer.RdYlGn8",
        "brewer.PiYG8",
        "brewer.PRGn8",
        "tableau.PurplePinkGray12",
      ],
      colors: {
        "tableau.Classic10": [
          "#1f77b4",
          "#ff7f0e",
          "#2ca02c",
          "#d62728",
          "#9467bd",
          "#8c564b",
          "#e377c2",
          "#7f7f7f",
          "#bcbd22",
          "#17becf",
        ],
        "brewer.DarkTwo8": [
          "#1b9e77",
          "#d95f02",
          "#7570b3",
          "#e7298a",
          "#66a61e",
          "#e6ab02",
          "#a6761d",
          "#666666",
        ],
        "brewer.SetOne8": [
          "#e41a1c",
          "#377eb8",
          "#4daf4a",
          "#984ea3",
          "#ff7f00",
          "#ffff33",
          "#a65628",
          "#f781bf",
        ],
        "tableau.MillerStone11": [
          "#4f6980",
          "#849db1",
          "#a2ceaa",
          "#638b66",
          "#bfbb60",
          "#f47942",
          "#fbb04e",
          "#b66353",
          "#d7ce9f",
          "#b9aa97",
          "#7e756d",
        ],
        "brewer.Accent8": [
          "#7fc97f",
          "#beaed4",
          "#fdc086",
          "#ffff99",
          "#386cb0",
          "#f0027f",
          "#bf5b17",
          "#666666",
        ],
        "tableau.GreenOrangeTeal12": [
          "#4e9f50",
          "#87d180",
          "#ef8a0c",
          "#fcc66d",
          "#3ca8bc",
          "#98d9e4",
          "#94a323",
          "#c3ce3d",
          "#a08400",
          "#f7d42a",
          "#26897e",
          "#8dbfa8",
        ],
        "brewer.RdYlGn8": [
          "#d73027",
          "#f46d43",
          "#fdae61",
          "#fee08b",
          "#d9ef8b",
          "#a6d96a",
          "#66bd63",
          "#1a9850",
        ],
        "brewer.PiYG8": [
          "#c51b7d",
          "#de77ae",
          "#f1b6da",
          "#fde0ef",
          "#e6f5d0",
          "#b8e186",
          "#7fbc41",
          "#4d9221",
        ],
        "brewer.PRGn8": [
          "#762a83",
          "#9970ab",
          "#c2a5cf",
          "#e7d4e8",
          "#d9f0d3",
          "#a6dba0",
          "#5aae61",
          "#1b7837",
        ],
        "tableau.PurplePinkGray12": [
          "#8074a8",
          "#c6c1f0",
          "#c46487",
          "#ffbed1",
          "#9c9290",
          "#c5bfbe",
          "#9b93c9",
          "#ddb5d5",
          "#7c7270",
          "#f498b6",
          "#b173a0",
          "#c799bc",
        ],
      },
      loader: {
        saveSettings: false,
        deleteDestination: false,
        deleteCallPattern: false,
        deleteCost: false,
        resetSettings: false,
      },
      error: {
        settings: {
          officeHourStart: "",
          officeHourEnd: "",
          queryLimit: "",
          nullCallTime: "",
          currency: "",
          newDestination: "",
          newCallPatternPrefix: "",
          newCallPatternDestination: "",
          newCostChannelId: "",
          newCostDestination: "",
          newCostValue: "",
        },
      },
      viewDoc: null,
    };
  },
  mounted() {
    this.retrieveShowFilter();

    if (this.get("loggedUser") && this.get("loggedUser").username == "admin") {
      this.isAdmin = true;
    } else {
      this.isAdmin = false;
    }

    if (this.isAdmin) {
      this.getAdminSettings();
    }

    // event "showCostsConfigModal" is triggered by ContentView
    this.$root.$on("showCostsConfigModal", this.showCostsConfigModal);

    // event "logout" is triggered by $http interceptor if token has expired
    this.$root.$on("logout", this.doLogout);

    // event "dataNotAvailable" is triggered by $http interceptor if queue report tables don't exist yet
    this.$root.$on("dataNotAvailable", this.onDataNotAvailable);

    // event "cdrDataNotAvailable" is triggered by $http interceptor if cdr report tables don't exist yet
    this.$root.$on("cdrDataNotAvailable", this.onCdrDataNotAvailable);

    this.viewDoc = this.retrieveViewDoc();
    this.retrieveColorScheme();
  },
  watch: {
    $route: function () {
      if (this.$route.meta.view == "default") {
        this.title = this.$i18n.t(this.$route.meta.name);
      } else {
        this.title =
          (this.$route.meta.section
            ? this.$i18n.t("menu." + this.$route.meta.section) + ": "
            : "") + this.$i18n.t(this.$route.meta.name);
      }
      this.viewDoc = this.retrieveViewDoc();

      if (!((this.dataAvailable && this.$route.meta.report == 'queue') || (this.cdrDataAvailable && this.$route.meta.report == 'cdr'))) {
        this.showFilters = false;
      }
    },
  },
  computed: {
    adminSettingsError: function () {
      // check if there is at least an error in admin settings
      return Object.values(this.error.settings).some((e) => e);
    },
  },
  methods: {
    onDataNotAvailable() {
      this.showFilters = false;
      this.dataAvailable = false;
    },
    onCdrDataNotAvailable() {
      this.showFilters = false;
      this.cdrDataAvailable = false;
    },
    retrieveShowFilter() {
      const showFilters = this.get("showFilters");

      if (showFilters != null) {
        this.showFilters = showFilters;
      } else {
        this.showFilters = true;
      }
      this.$forceUpdate();
    },
    toggleFilters: function () {
      if ((this.dataAvailable && this.$route.meta.report == 'queue') || (this.cdrDataAvailable && this.$route.meta.report == 'cdr')) {
        this.showFilters = !this.showFilters;
        this.set("showFilters", this.showFilters);
        this.$root.$emit("toggleFilters");
      }
    },
    doLogout() {
      this.execLogout(
        () => {
          this.$parent.didLogout();
        },
        (error) => {
          // print error
          console.error(error.body);
        }
      );
    },
    showSettingsModal(value) {
      this.openSettingsModal = value;

      if (!value) {
        this.highlightCostsSettings = false;
      }
    },
    validateAdminSettings() {
      // reset errors
      for (const key of Object.keys(this.error.settings)) {
        this.error.settings[key] = "";
      }
      let errors = false;

      // office hour start

      if (!this.adminSettings.officeHourStart) {
        this.error.settings.officeHourStart = "office_hours_invalid";

        if (!errors) {
          errors = true;
          this.$nextTick(() =>
            this.$refs.officeHourStart.$el.children[0].focus()
          );
        }
      }

      // office hour end

      if (!this.adminSettings.officeHourEnd) {
        this.error.settings.officeHourEnd = "office_hours_invalid";

        if (!errors) {
          errors = true;
          this.$nextTick(() =>
            this.$refs.officeHourEnd.$el.children[0].focus()
          );
        }
      }

      // query limit

      if (
        !this.adminSettings.queryLimit ||
        this.adminSettings.queryLimit < 10
      ) {
        this.error.settings.queryLimit = "query_limit_invalid";

        if (!errors) {
          errors = true;
          this.$nextTick(() => this.$refs.queryLimit.$el.children[0].focus());
        }
      }

      // null call

      if (this.adminSettings.nullCallTime < 0) {
        this.error.settings.nullCallTime = "null_call_invalid";

        if (!errors) {
          errors = true;
          this.$nextTick(() => this.$refs.nullCallTime.$el.children[0].focus());
        }
      }

      // currency

      if (!this.adminSettings.currency) {
        this.error.settings.currency = "currency_empty";

        if (!errors) {
          errors = true;
          this.$nextTick(() => this.$refs.currency.$el.children[0].focus());
        }
      }

      // new destination is validated by validateNewDestination()

      // new call pattern is validated by validateNewCallPattern()

      // new cost is validated by validateNewCost()

      return !errors;
    },
    saveAdminSettings(closeModal = true) {
      if (!this.validateAdminSettings()) {
        return;
      }

      // apply changes

      if (closeModal) {
        this.loader.saveSettings = true;
      }

      this.updateSettings(
        {
          start_hour: this.adminSettings.officeHourStart,
          end_hour: this.adminSettings.officeHourEnd,
          query_limit: this.adminSettings.queryLimit.toString(),
          null_call_time: this.adminSettings.nullCallTime.toString(),
          currency: this.adminSettings.currency,
          destinations: this.adminSettings.destinations,
          call_patterns: this.adminSettings.callPatterns,
          costs: this.mapCostsForBackend(),
        },
        () => {
          this.loader.saveSettings = false;
          this.loader.deleteDestination = false;
          this.loader.deleteCallPattern = false;
          this.loader.deleteCost = false;
          this.hideDeleteDestinationModal();
          this.hideDeleteCallPatternModal();
          this.hideDeleteCostModal();

          if (closeModal) {
            this.showSettingsModal(false);
          }
          this.getAdminSettings();
        },
        (error) => {
          this.loader.saveSettings = false;
          console.error(error.body);
        }
      );
    },
    getAdminSettings() {
      this.getSettings(
        (success) => {
          const settings = success.body.settings;
          this.adminSettings.officeHourStart = settings.start_hour;
          this.adminSettings.officeHourEnd = settings.end_hour;
          this.adminSettings.queryLimit = Number(settings.query_limit);
          this.adminSettings.nullCallTime = Number(settings.null_call_time);
          this.adminSettings.currency = settings.currency;
          this.adminSettings.destinations = settings.destinations;

          // sort call patterns by prefix length
          this.adminSettings.callPatterns = settings.call_patterns.sort(
            (cp1, cp2) => {
              return cp2.prefix.length - cp1.prefix.length;
            }
          );

          // destinationOptions is used for destinations dropdown
          this.destinationOptions = this.adminSettings.destinations.map((d) => {
            return { value: d, text: d };
          });

          // costs
          this.adminSettings.costs = this.mapCostsFromBackend(settings.costs);

          this.retrieveTrunks();
        },
        (error) => {
          console.error(error.body);
        }
      );
    },
    retrieveColorScheme() {
      let colorScheme = this.get("reportColorScheme");

      if (colorScheme) {
        this.$root.colorScheme = colorScheme;
      } else {
        this.$root.colorScheme = this.colorSchemes[0];

        // save to local storage
        this.set("reportColorScheme", this.$root.colorScheme);
      }
    },
    setColorScheme(colorScheme) {
      this.$root.colorScheme = colorScheme;

      // save to local storage
      this.set("reportColorScheme", this.$root.colorScheme);
    },
    configureCosts() {
      this.openCostsConfigModal = false;
      this.showSettingsModal(true);
      this.highlightCostsSettings = true;
      this.set("costsConfigured", true);
      this.$root.$emit("reloadAdminSettings");
    },
    skipCostsConfiguration() {
      this.openCostsConfigModal = false;
      this.set("costsConfigured", true);
      this.$root.$emit("reloadAdminSettings");
    },
    validateNewDestination() {
      // reset error
      this.error.settings.newDestination = "";

      // check empty or duplicated
      if (
        !this.newDestination ||
        this.adminSettings.destinations.find(
          (d) => d.toLowerCase() == this.newDestination.toLowerCase()
        )
      ) {
        this.error.settings.newDestination = "destination_invalid";
        this.$nextTick(() => this.$refs.newDestination.$el.children[0].focus());
      }
      return !this.error.settings.newDestination;
    },
    createDestination() {
      if (!this.validateAdminSettings() || !this.validateNewDestination()) {
        return;
      }
      this.adminSettings.destinations.push(this.newDestination);

      // show temporary icon for destination just created
      this.destinationJustCreated = this.newDestination;
      setTimeout(() => {
        this.destinationJustCreated = "";
      }, 5000);

      this.saveAdminSettings(false);
      this.newDestination = "";
    },
    validateNewCallPattern() {
      // reset errors
      this.error.settings.newCallPatternPrefix = "";
      this.error.settings.newCallPatternDestination = "";

      // prefix

      const prefixDuplicated = this.adminSettings.callPatterns.find(
        (cp) => cp.prefix == this.newCallPattern.prefix
      );

      const prefixValidSyntax = /^\+?[0-9]+$/.test(this.newCallPattern.prefix);

      if (!this.newCallPattern.prefix) {
        this.error.settings.newCallPatternPrefix = "call_pattern_prefix_empty";
        this.$nextTick(() =>
          this.$refs.newCallPatternPrefix.$el.children[0].focus()
        );
      } else if (!prefixValidSyntax) {
        this.error.settings.newCallPatternPrefix =
          "call_pattern_prefix_invalid";
        this.$nextTick(() =>
          this.$refs.newCallPatternPrefix.$el.children[0].focus()
        );
      } else if (prefixDuplicated) {
        this.error.settings.newCallPatternPrefix =
          "call_pattern_prefix_duplicated";
        this.$nextTick(() =>
          this.$refs.newCallPatternPrefix.$el.children[0].focus()
        );
      }

      // destination

      if (!this.newCallPattern.destination) {
        this.error.settings.newCallPatternDestination =
          "call_pattern_destination_empty";
        this.$nextTick(() =>
          this.$refs.newCallPatternDestination.$el.children[0].focus()
        );
      }

      return (
        !this.error.settings.newCallPatternPrefix &&
        !this.error.settings.newCallPatternDestination
      );
    },
    createCallPattern() {
      if (!this.validateAdminSettings() || !this.validateNewCallPattern()) {
        return;
      }
      this.adminSettings.callPatterns.push(this.newCallPattern);

      // show temporary icon for call pattern just created
      this.callPatternJustCreated = this.newCallPattern;
      setTimeout(() => {
        this.callPatternJustCreated = { prefix: "", destination: null };
      }, 7000);

      this.saveAdminSettings(false);
      this.newCallPattern = { prefix: "", destination: null };
    },
    validateNewCost() {
      // reset errors
      this.error.settings.newCostChannelId = "";
      this.error.settings.newCostDestination = "";
      this.error.settings.newCostValue = "";

      // channel id (trunk)

      if (!this.newCost.channelId) {
        this.error.settings.newCostChannelId = "cost_channel_id_empty";
        this.$nextTick(() =>
          this.$refs.newCostChannelId.$el.children[0].focus()
        );
      }

      // destination

      if (!this.newCost.destination) {
        this.error.settings.newCostDestination = "cost_destination_empty";
        this.$nextTick(() =>
          this.$refs.newCostDestination.$el.children[0].focus()
        );
      }

      // cost value

      if (!this.newCost.cost.toString().length || this.newCost.cost < 0) {
        this.error.settings.newCostValue = "cost_value_invalid";
        this.$nextTick(() => this.$refs.newCostValue.focus());
      }

      // check cost duplicated

      const costDuplicated = this.adminSettings.costs.find(
        (c) =>
          c.channelId == this.newCost.channelId &&
          c.destination == this.newCost.destination
      );

      if (costDuplicated) {
        this.error.settings.newCostChannelId = "cost_duplicated";
        this.error.settings.newCostDestination = "cost_duplicated";
        this.$nextTick(() =>
          this.$refs.newCostChannelId.$el.children[0].focus()
        );
      }

      return (
        !this.error.settings.newCostChannelId &&
        !this.error.settings.newCostDestination &&
        !this.error.settings.newCostValue
      );
    },
    createCost() {
      if (!this.validateAdminSettings() || !this.validateNewCost()) {
        return;
      }
      this.adminSettings.costs.push(this.newCost);

      // show temporary icon for cost just created
      this.costJustCreated = this.newCost;
      setTimeout(() => {
        this.costJustCreated = { channelId: null, destination: null, cost: "" };
      }, 5000);

      this.saveAdminSettings(false);
      this.newCost = { channelId: null, destination: null, cost: "" };
    },
    showDeleteDestinationModal(destinationToDelete) {
      if (!this.validateAdminSettings()) {
        return;
      }
      this.destinationToDelete = destinationToDelete;
      this.openDeleteDestinationModal = true;
    },
    showDeleteCallPatternModal(callPatternToDelete) {
      if (!this.validateAdminSettings()) {
        return;
      }
      this.callPatternToDelete = callPatternToDelete;
      this.openDeleteCallPatternModal = true;
    },
    showDeleteCostModal(costToDelete) {
      if (!this.validateAdminSettings()) {
        return;
      }
      this.costToDelete = costToDelete;
      this.openDeleteCostModal = true;
    },
    hideDeleteDestinationModal() {
      this.destinationToDelete = "";
      this.openDeleteDestinationModal = false;
    },
    hideDeleteCallPatternModal() {
      this.callPatternToDelete = { prefix: "", destination: null };
      this.openDeleteCallPatternModal = false;
    },
    hideDeleteCostModal() {
      this.costToDelete = { channelId: null, destination: null, cost: "" };
      this.openDeleteCostModal = false;
    },
    deleteDestination() {
      this.loader.deleteDestination = true;
      this.adminSettings.destinations = this.adminSettings.destinations.filter(
        (d) => d !== this.destinationToDelete
      );
      this.saveAdminSettings(false);
    },
    deleteCallPattern() {
      this.loader.deleteCallPattern = true;
      this.adminSettings.callPatterns = this.adminSettings.callPatterns.filter(
        (cp) => cp.prefix !== this.callPatternToDelete.prefix
      );
      this.saveAdminSettings(false);
    },
    deleteCost() {
      this.loader.deleteCost = true;
      this.adminSettings.costs = this.adminSettings.costs.filter(
        (c) =>
          !(
            c.channelId == this.costToDelete.channelId &&
            c.destination == this.costToDelete.destination
          )
      );
      this.saveAdminSettings(false);
    },
    retrieveTrunks() {
      this.getFilterField(
        "trunks",
        (success) => {
          const trunkStrings = success.body.filter;
          if (!trunkStrings) return
          let trunks = [];

          for (const trunkString of trunkStrings) {
            const split = trunkString.split(",");
            trunks.push({ name: split[0], channelId: split[1] });
          }
          this.trunks = trunks;

          // trunkOptions is used for trunks dropdown
          this.trunkOptions = this.trunks.map((t) => {
            return { value: t.channelId, text: t.name };
          });
        },
        (error) => {
          console.error(error.body);
        }
      );
    },
    mapCostsFromBackend(costsBackend) {
      let costs = [];

      for (const c of costsBackend) {
        costs.push({
          channelId: c.channel_id,
          destination: c.destination,
          cost: c.cost,
        });
      }
      return costs;
    },
    mapCostsForBackend() {
      let costsBackend = [];

      for (const c of this.adminSettings.costs) {
        costsBackend.push({
          channel_id: c.channelId,
          destination: c.destination,
          cost: c.cost.toString(),
        });
      }
      return costsBackend;
    },
    showCostsConfigModal() {
      this.openCostsConfigModal = true;
    },
    hideResetSettingsModal() {
      this.openResetSettingsModal = false;
    },
    showResetSettingsModal() {
      this.openResetSettingsModal = true;
    },
    resetAdminSettings() {
      this.loader.resetSettings = true;

      this.deleteSettings(
        () => {
          this.loader.resetSettings = false;
          this.getAdminSettings();
          this.hideResetSettingsModal();

          // reset validation errors
          for (const key of Object.keys(this.error.settings)) {
            this.error.settings[key] = "";
          }
        },
        (error) => {
          console.error(error.body);
          this.loader.resetSettings = false;
        }
      );
    },
    retrieveViewDoc() {
      try {
        let mdDoc = require("../doc-inline/" +
          this.$root.currentLocale +
          "/" +
          this.$route.meta.report +
          "/" +
          this.$route.meta.section +
          "_" +
          this.$route.meta.view +
          ".md");
        return mdDoc.default;
      } catch (error) {
        return null;
      }
    },
  },
};
</script>

<style lang="scss">
.topbar .top.floating.dropdown .menu {
  left: -60px !important;
  margin-top: 12px !important;
}

.filter-button {
  width: calc(100% + 1px);

  .icon {
    margin-right: 10px !important;
  }
}

.view-title {
  display: inline-block;
}

.component-head-menu {
  margin: 3rem 0rem 0rem !important;
}

.ui.menu .dropdown.item .menu.color-scheme {
  min-width: 12rem;
}

.color-sample {
  display: inline-block;
  width: 1rem;
  height: 1rem;
}

.ui.menu:not(.vertical) .right.item,
.ui.menu:not(.vertical) .right.menu {
  border-right: 1px solid rgba(34, 36, 38, 0.15);
}

.filters-form .ui.multiple.search.dropdown > .text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.input-warning {
  background-color: #fffaf3 !important;
  color: #573a08 !important;
  border: none !important;
  -webkit-box-shadow: 0 0 0 1px #c9ba9b inset, 0 0 0 0 transparent !important;
  box-shadow: 0 0 0 1px #c9ba9b inset, 0 0 0 0 transparent !important;
}

.destination {
  min-height: 8rem !important;
}

.destination .header {
  font-size: 1.1em !important;
}

.destination .input {
  width: 85%;
}

.call-patterns-accordion {
  margin-top: 1.5rem;
}

.call-patterns-accordion .title {
  display: inline-block;
}

.doc-info-view-title {
  position: relative;
  top: -0.25rem;
  left: 0.25rem;
}
</style>
