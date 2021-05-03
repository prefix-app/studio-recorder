<template>
  <div class="tab recording-tab">
    <div class="content">
      <div class="events" v-show="true">
        <p class="text-muted text-center loading" v-show="liveEvents.length === 0">Waiting for events</p>
        <ul class="event-list" v-show="liveEvents.length > 0">
          <li v-for="(event, index) in liveEvents" :key="index" class="event-list-item">
            <div class="event-description">
              <div class="event-action">{{event.action}}</div>
              <div class="event-props text-muted">{{event.readableName || parseEventValue(event)}}</div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script>
  export default {
    name: 'RecordingTab',
    props: {
      isRecording: { type: Boolean, default: false },
      liveEvents: { type: Array, default: () => { return [] } }
    },
    methods: {
      parseEventValue (event) {
        if (event.action === 'viewport*') return `width: ${event.value.width}, height: ${event.value.height}`
        if (event.action === 'goto*') return event.href
        if (event.action === 'navigation*') return ''
      }
    }
  }
</script>
<style lang="scss" scoped>
  @import "~styles/_animations.scss";
  @import "~styles/_variables.scss";

  .loading {
    margin-bottom: auto;
    margin-top: auto;
  }

  .recording-tab {
    .content {
      display:flex;
      flex-direction:column;
      height:100%;
      min-height: 200px;
      .empty {
        padding: $spacer;
        text-align: center;
      }

      .events {
        max-height: $max-content-height;
        flex: 1;
        height:100%;
        overflow: auto;
        display: flex;
        flex-direction: column-reverse;

        .loading:after {
          content: '.';
          animation: dots 1s steps(5, end) infinite;
          animation-delay: 1.5s;
          margin-bottom: auto;
        }

        .event-list {
          list-style-type: none;
          padding: 0;
          margin: 0;

          .event-list-item {
            padding: 12px;
            font-size: 12px;
            border-top: 1px solid $gray-light;
            display: flex;
            flex: 1 1 auto;
            height: 32px;

            .event-label {
              vertical-align: top;
              margin-right: $spacer;
            }

            .event-description {
              margin-right: auto;
              display: inline-block;

              .event-action {
                font-weight: bold;
              }

              .event-props {
                white-space: pre;
              }
            }

          }
        }
      }
    }
    .nag-cta {
      margin-bottom: $spacer;
      a {
        color: $pink;
        font-size: 80%;
        font-weight: 500;
      }
    }
  }
</style>
