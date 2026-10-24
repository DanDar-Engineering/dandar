import { gql } from "~/gql";

export const VOICE_STATUS_QUERY = gql(`
  query dandarVoiceStatus {
    dandarVoiceStatus {
      configured
    }
  }
`);

export const SPEAK_MUTATION = gql(`
  mutation dandarSpeak($text: String!) {
    dandarSpeak(text: $text) {
      audioUrl
    }
  }
`);

export const TRANSCRIBE_MUTATION = gql(`
  mutation dandarTranscribe($audioData: String!) {
    dandarTranscribe(audioData: $audioData)
  }
`);
