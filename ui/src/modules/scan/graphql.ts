import { gql } from "~/gql";

// Lists skip the photo; ScanDetailSheet loads it with dandarScanDetail.
export const SCANS_QUERY = gql(`
  query dandarScans($limit: Int!, $offset: Int!) {
    dandarScans(limit: $limit, offset: $offset) {
      _id
      teacherId
      fileName
      kind
      title
      subject
      summary
      status
      teacherComment
      createdAt
    }
  }
`);

export const SCANS_INBOX_QUERY = gql(`
  query dandarScansInbox($limit: Int!, $offset: Int!) {
    dandarScansInbox(limit: $limit, offset: $offset) {
      _id
      studentId
      fileName
      kind
      title
      subject
      status
      teacherComment
      sentAt
    }
  }
`);

export const SCAN_DETAIL_QUERY = gql(`
  query dandarScanDetail($_id: String!) {
    dandarScanDetail(_id: $_id) {
      _id
      studentId
      teacherId
      text
      kind
      title
      subject
      summary
      status
      teacherComment
      imageUrl
      createdAt
    }
  }
`);

// Reads only; ScanWizard saves after the student confirms the fields.
export const SCAN_READ_MUTATION = gql(`
  mutation dandarScanRead($mimeType: String!, $imageData: String!) {
    dandarScanRead(mimeType: $mimeType, imageData: $imageData) {
      text
      kind
      title
      subject
      summary
      confident
    }
  }
`);

export const SCAN_SAVE_MUTATION = gql(`
  mutation dandarScanSave(
    $fileName: String!
    $mimeType: String!
    $imageData: String!
    $text: String!
    $kind: DandarScanKind!
    $title: String!
    $subject: String
    $summary: String
    $teacherId: String
  ) {
    dandarScanSave(
      fileName: $fileName
      mimeType: $mimeType
      imageData: $imageData
      text: $text
      kind: $kind
      title: $title
      subject: $subject
      summary: $summary
      teacherId: $teacherId
    ) {
      _id
      status
    }
  }
`);

export const SCAN_SEND_MUTATION = gql(`
  mutation dandarScanSendToTeacher($_id: String!, $teacherId: String!) {
    dandarScanSendToTeacher(_id: $_id, teacherId: $teacherId) {
      _id
      teacherId
      status
    }
  }
`);

export const SCAN_REVIEW_MUTATION = gql(`
  mutation dandarScanReview($_id: String!, $comment: String!) {
    dandarScanReview(_id: $_id, comment: $comment) {
      _id
      status
      teacherComment
    }
  }
`);
