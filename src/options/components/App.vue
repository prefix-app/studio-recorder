<template>
	<div class="options">
		<div class="container">
			<div class="header">
				<small class="saving-badge text-muted" v-show="saving">
					Saving...
				</small>
			</div>
			<div class="content" v-if="!loading">
				<div class="settings-block">
					<h4 class="settings-block-title">Recorder Settings</h4>
					<div class="settings-block-main">
						<div class="settings-group">
							<label class="settings-label">advanced selector rules</label>
							<input
								id="options-code-dataAttribute"
								type="text"
								v-model.trim="options.code.dataAttribute"
								@change="save"
								placeholder="Custom data-* attribute"
								style="font-family: inherit !important"
							/>
							<small
								>Define an attribute that we'll attempt to use when selecting
								the elements, i.e "data-custom". This is handy when React or Vue
								based apps generate random class names.</small
							>
							<small class="settings-warning"
								>⚠️ Modifying selector rules may cause automations to fail or
								become brittle</small
							>
						</div>
						<!--
            <div class="settings-group">
              <label class="settings-label">data entry</label>
              <div class="settings-block">
                <button class="btn btn-sm btn-primary" @click="listenForKeyCodePress">{{ recordingKeyCodePress ? 'Capturing' : 'Click to capture key code'}}</button>
                <input id="options-code-keyCode" readonly disabled type="number" v-model.number="options.code.keyCode" placeholder="Key Code for input fields (ex. 9 = Tab)">
              </div>
              <small>What key will be used for capturing input changes. The value here is the key code. This will not handle multiple keys.</small>
            </div>
            -->
						<div class="settings-group" style="margin-top: 14px !important">
							<label class="settings-label">data extraction</label>
							<small
								>Prefix does not currently support recording data extraction. To
								select data to scrape or export out of a website, please use
								"Discover Elements" from the Studio.</small
							>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { defaults as code } from "../../code-generator/CodeGenerator";

const defaults = {
	code,
	extension: {
		telemetry: false,
	},
};

export default {
	name: "App",
	data() {
		return {
			loading: true,
			saving: false,
			options: defaults,
			recordingKeyCodePress: false,
		};
	},
	mounted() {
		this.load();
	},
	methods: {
		save() {
			this.saving = true;
			this.$chrome.storage.local.set({ options: this.options }, () => {
				console.debug("saved options");
				setTimeout(() => {
					this.saving = false;
				}, 500);
			});
		},
		load() {
			this.$chrome.storage.local.get("options", ({ options }) => {
				if (options) {
					console.debug("loaded options", JSON.stringify(options));
					this.options = options;
				}
				this.loading = false;
			});
		},
		listenForKeyCodePress() {
			this.recordingKeyCodePress = true;
			const keyDownFunction = (e) => {
				this.recordingKeyCodePress = false;
				this.updateKeyCodeWithNumber(e);
				window.removeEventListener("keydown", keyDownFunction, false);
				e.preventDefault();
			};
			window.addEventListener("keydown", keyDownFunction, false);
		},
		updateKeyCodeWithNumber(evt) {
			this.options.code.keyCode = parseInt(evt.keyCode, 10);
			this.save();
		},
	},
};
</script>

<style lang="scss" scoped>
@import "~styles/_variables.scss";
@import "~styles/_mixins.scss";

.options {
	height: 100%;
	min-height: 580px;
	background: $gray-lighter;
	display: flex;
	flex-direction: column;
	width: 100%;
	overflow: auto;
	position: fixed;
	left: 0;
	top: 0;

	.container {
		padding: 0 2 * $spacer;
		width: 550px;
		margin: 0 auto;

		.content {
			background: white;
			padding: 2 * $spacer;
			border-radius: 4px;
			min-height: 500px;
		}

		.footer {
			@include footer();
			background: $gray-lighter;
			font-weight: normal;
			justify-content: center;
			img {
				margin-left: 8px;
				width: 80px;
				vertical-align: middle;
			}
		}

		.header {
			@include header();
			background: $gray-lighter;
			justify-content: space-between;
		}

		.settings-block {
			.settings-label {
				display: block;
				text-transform: uppercase;
				font-size: 0.75rem;
				font-weight: 500;
				margin-bottom: $spacer;
			}

			.settings-warning {
				display: block;
				font-size: 0.75rem;
				font-weight: 500;
				color: $pink;
				margin: $spacer 0;
			}

			.settings-block-title {
				margin: 0;
				padding-bottom: $spacer;
				border-bottom: 1px solid $gray-light;
			}

			.settings-block-main {
				padding: $spacer 0;
				margin-bottom: $spacer;

				.settings-group {
					margin-top: $spacer;
					padding-top: $spacer;
					margin-bottom: $spacer;
					display: block;
				}
			}
			input[type="text"],
			input[type="number"] {
				margin-bottom: 10px;
				width: 100%;
				border: 1px solid $gray-light;
				padding-left: 15px;
				height: 38px;
				font-size: 14px;
				border-radius: 10px;
				-webkit-box-sizing: border-box;
			}
			input[type="number"] {
				width: 50px;
			}
		}
	}
}
</style>
