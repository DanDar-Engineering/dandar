import { gql } from "~/gql";

// Every operation name starts with `dandar`: the supergraph is shared.
export const STUDY_COUNTS_QUERY = gql(`
  query dandarStudyCounts {
    dandarStudyCounts {
      newCards
      dueCards
      total
      nextDueAt
    }
  }
`);

export const DUE_CARDS_QUERY = gql(`
  query dandarDueCards($limit: Int!) {
    dandarDueCards(limit: $limit) {
      _id
      deck
      front
      back
      reviews
      preview {
        forgot
        unsure
        know
        easy
      }
    }
  }
`);

export const STUDY_CARDS_QUERY = gql(`
  query dandarStudyCards($deck: String, $search: String, $limit: Int!, $offset: Int!) {
    dandarStudyCards(deck: $deck, search: $search, limit: $limit, offset: $offset) {
      _id
      deck
      front
      back
      retention
      dueAt
    }
  }
`);

export const DECK_MASTERY_QUERY = gql(`
  query dandarDeckMastery {
    dandarDeckMastery {
      deck
      cards
      mastery
      weak
    }
  }
`);

export const EXAMS_QUERY = gql(`
  query dandarExams {
    dandarExams {
      deck
      examAt
      cards
      daysLeft
      readiness
      rounds
      targetRounds
    }
  }
`);

export const CARD_ADD_MUTATION = gql(`
  mutation dandarCardAdd($deck: String!, $front: String!, $back: String!) {
    dandarCardAdd(deck: $deck, front: $front, back: $back) {
      _id
    }
  }
`);

export const CARD_DELETE_MUTATION = gql(`
  mutation dandarCardDelete($_id: String!) {
    dandarCardDelete(_id: $_id)
  }
`);

export const CARD_REVIEW_MUTATION = gql(`
  mutation dandarCardReview($_id: String!, $grade: DandarCardGrade!) {
    dandarCardReview(_id: $_id, grade: $grade) {
      _id
      dueAt
    }
  }
`);

// Drafts only: nothing is stored until the student saves the checked cards.
export const CARDS_DRAFT_MUTATION = gql(`
  mutation dandarCardsDraft(
    $notes: String
    $scanIds: [String!]
    $mimeType: String
    $imageData: String
    $options: DandarCardOptionsInput
  ) {
    dandarCardsDraft(
      notes: $notes
      scanIds: $scanIds
      mimeType: $mimeType
      imageData: $imageData
      options: $options
    ) {
      deck
      examDate
      cards {
        front
        back
      }
    }
  }
`);

export const CARDS_SAVE_MUTATION = gql(`
  mutation dandarCardsSave(
    $deck: String!
    $cards: [DandarCardInput!]!
    $examDate: String
    $scanIds: [String!]
  ) {
    dandarCardsSave(deck: $deck, cards: $cards, examDate: $examDate, scanIds: $scanIds) {
      _id
    }
  }
`);

export const EXAM_SET_MUTATION = gql(`
  mutation dandarExamSet($deck: String!, $date: String!) {
    dandarExamSet(deck: $deck, date: $date) {
      deck
      examAt
    }
  }
`);

export const EXAM_DELETE_MUTATION = gql(`
  mutation dandarExamDelete($deck: String!) {
    dandarExamDelete(deck: $deck)
  }
`);

export const CARD_HELP_MUTATION = gql(`
  mutation dandarCardHelp($_id: String!, $mode: DandarCardHelpMode!) {
    dandarCardHelp(_id: $_id, mode: $mode)
  }
`);

export const STUDY_SETTINGS_QUERY = gql(`
  query dandarStudySettings {
    dandarStudySettings {
      reviewReminder
      reminderHour
      examAlerts
      quietStart
      quietEnd
    }
  }
`);

export const STUDY_SETTINGS_SAVE_MUTATION = gql(`
  mutation dandarStudySettingsSave($input: DandarStudySettingsInput!) {
    dandarStudySettingsSave(input: $input) {
      reviewReminder
      reminderHour
      examAlerts
      quietStart
      quietEnd
    }
  }
`);

export const SCAN_CARD_COUNTS_QUERY = gql(`
  query dandarScanCardCounts {
    dandarScanCardCounts {
      scanId
      cards
    }
  }
`);

export const QUIZ_QUERY = gql(`
  query dandarQuiz($deck: String, $size: Int!) {
    dandarQuiz(deck: $deck, size: $size) {
      cardId
      deck
      front
      choices
    }
  }
`);

export const QUIZ_ANSWER_MUTATION = gql(`
  mutation dandarQuizAnswer($cardId: String!, $choice: String!) {
    dandarQuizAnswer(cardId: $cardId, choice: $choice) {
      correct
      answer
      card {
        _id
        dueAt
      }
    }
  }
`);

export const STUDY_PROGRESS_QUERY = gql(`
  query dandarStudyProgress {
    dandarStudyProgress {
      activeDays
      reviewedThisWeek
      rememberedRate
      days {
        date
        reviewed
        remembered
      }
      forecast {
        date
        due
      }
    }
  }
`);

export const CARD_UPDATE_MUTATION = gql(`
  mutation dandarCardUpdate($_id: String!, $deck: String!, $front: String!, $back: String!) {
    dandarCardUpdate(_id: $_id, deck: $deck, front: $front, back: $back) {
      _id
      deck
      front
      back
    }
  }
`);

export const DECK_RENAME_MUTATION = gql(`
  mutation dandarDeckRename($from: String!, $to: String!) {
    dandarDeckRename(from: $from, to: $to)
  }
`);

export const DECK_DELETE_MUTATION = gql(`
  mutation dandarDeckDelete($deck: String!) {
    dandarDeckDelete(deck: $deck)
  }
`);

// Operations whose result changes after cards are added, reviewed or removed.
export const STUDY_REFETCH = [
  "dandarStudyCounts",
  "dandarDueCards",
  "dandarStudyCards",
  "dandarDeckMastery",
  "dandarExams",
  "dandarScanCardCounts",
  "dandarStudyProgress",
];
