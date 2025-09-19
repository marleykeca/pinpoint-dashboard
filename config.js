window.PinpointConfig = {
  mode: 'airtable',
  baseId: 'app8DYNGb6aNN3Djl',
  fields: {
    creator: {
      id: 'creator_id_',
      first: 'creator_first_name',
      last: 'creator_last_name',
      artist: 'creator_artist_name',
      email: 'creator_email'
    },
    request: {
      id: 'request_id_',
      creatorId: 'creator_id_',            // linked-record array (rec…)
      date: 'request_submission_date',
      title: 'track_title',
      stage: 'track_stage'
    },
    report: {
      id: 'report_id_',
      requestId: 'request_id_',            // linked-record array (rec…)
      category: 'report_category',        // from your JSON
      calibre: 'calibre',
      raw: 'feedback_raw',                // from your JSON
      strengths: 'strengths',             // object with { value }
      opportunities: 'opportunities',     // object with { value }
      actual: 'current_score',
      potential: 'potential_score'
    },
    action: {
      id: 'action_id_',
      reportId: 'report_id_',                 // IMPORTANT: linked-record array (rec…)
      anchor: 'anchor_text',
      details: 'description',
      category: 'report_category'         // optional: actions carry this too
    }
  }
};
