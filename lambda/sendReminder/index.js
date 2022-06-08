const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const { runQuery, TABLE_NAME } = require('../dynamoUtil');
const { sendResponse } = require('../responseUtil');
const { formatISO, parseISO, format } = require('date-fns');
const { utcToZonedTime, zonedTimeToUtc } = require('date-fns-tz');

// default look-ahead days
const LOOK_AHEAD_DAYS = 1;
const PASS_STATUS_INDEX = process.env.PASS_STATUS_INDEX || 'passStatus-index';

exports.handler = async (event, context) => {
  console.log('Send Reminder Emails', event);

  // Get all passes that will be active at the look-ahead time. 
  try {

    // Determine look-ahead date
    // Done this way to account for rollovers at the end of months & years
    // The look-ahead date should be in UTC to properly search on the database. 
    const localDate = utcToZonedTime(Date.now(), 'America/Vancouver'); // today's date in PST/PDT
    let today = localDate;
    const future = today.setDate(today.getDate() + LOOK_AHEAD_DAYS); // add 1 day
    const futureLocalDate = new Date(future); // tomorrow's date in PST/PDT
    const futureUTCDate = zonedTimeToUtc(futureLocalDate, `America/Vancouver`) // tomorrow's date in UTC
    const lookAheadDate = formatISO(futureUTCDate, { representation: 'date' }); // tomorrow's shorthand date in UTC

    console.log('future:', future);
    console.log('localDate:', localDate);
    console.log('futureLocalDate:', futureLocalDate);
    console.log('futureUTCDate:', futureUTCDate);
    console.log('today:', today);
    console.log('lookAheadDate:', lookAheadDate);

    // Construct query for all passes reserved for the look-ahead date
    // Query on index 'passStatus-index' to collect passes for all parks at once
    let queryObj = {
      TableName: TABLE_NAME,
      IndexName: PASS_STATUS_INDEX,
      ExpressionAttributeNames: {
        '#passStatus': 'passStatus',
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':status': { S: 'reserved' },
        ':date': { S: lookAheadDate },
      },
      KeyConditionExpression: '#passStatus = :status',
      FilterExpression: 'begins_with(#date, :date)'
    };
    const passData = await runQuery(queryObj);
    if (passData) {
      console.log(passData.length + ' pass(es) fetched.');
    } else {
      console.log('No passes fetched.');
    }

    // construct array of data to pass to GCNotify
    // entries must follow the order of the bulkReminderRows array:
    let bulkReminderRows = [["email address", "park", "facility", "date", "type", "registrationNumber", "cancellationLink"]];

    if (passData) {
      for (let pass of passData) {
        const row = [
          pass.email || null,
          pass.pk.split('::')[1] || null,
          pass.facilityName || null,
          format(parseISO(pass.date), 'MMM dd, yyyy') || null,
          pass.type || null,
          pass.sk || null,
          buildCancellationLink(pass)
        ];
        bulkReminderRows.push(row);
      }
    }

    console.log('rows', bulkReminderRows);

    // send bulk emails
    try {
      
      await axios({
        method: 'post',
        url: process.env.GC_NOTIFY_API_BULK_PATH,
        headers: {
          Authorization: process.env.GC_NOTIFY_API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          name: `DUP bulk reminders: sent ${localDate} for ${futureLocalDate}`,
          template_id: process.env.GC_NOTIFY_REMINDER_TEMPLATE_ID,
          rows: bulkReminderRows
        }
      });
      return sendResponse(200, { msg: `GCN emails sent for ${futureLocalDate}` });
    } catch (err) {
      console.log('GCNotify error', err);
      return sendResponse(400, { err: err, title: 'Emails failed to send' });
    }

  } catch (err) {
    // something unknown went wrong.
    console.log('err', err);
    return sendResponse(400, { msg: 'Something went wrong.', title: 'Operation Failed' });
  }

}

function buildCancellationLink(pass) {
  const dateselector = formatISO(new Date(pass.date), { representation: 'date' });
  const cancellationLink = process.env.PUBLIC_FRONTEND +
    process.env.PASS_CANCELLATION_ROUTE +
    '?passId=' +
    pass.sk +
    '&email=' +
    pass.email +
    '&park=' +
    pass.pk.split('::')[1] +
    '&date=' +
    dateselector +
    '&type=' +
    pass.type;
  return cancellationLink;
}