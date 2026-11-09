var fs = require('fs');
var net = require('net');

var amiConfigCache;

function loadAmiConfig() {
  if (amiConfigCache) {
    return amiConfigCache;
  }

  amiConfigCache = JSON.parse(fs.readFileSync('/etc/nethcti/asterisk.json', 'utf8'));
  return amiConfigCache;
}

function parseAmiMessage(message) {
  var parsed = {};

  message.split(/\r\n/).forEach(function (line) {
    var separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      return;
    }

    var key = line.substring(0, separatorIndex).trim().toLowerCase();
    var value = line.substring(separatorIndex + 1).trim();
    parsed[key] = value;
  });

  return parsed;
}

function getActiveLinkedids(cb) {
  try {
    var amiConfig = loadAmiConfig();
    var socket = net.createConnection({
      host: amiConfig.host || 'localhost',
      port: parseInt(amiConfig.port, 10) || 5038
    });
    var actionId = 'answered-elsewhere-' + Date.now();
    var buffer = '';
    var loggedIn = false;
    var completed = false;
    var activeLinkedids = {};
    var timeout = setTimeout(function () {
      cleanup(new Error('AMI CoreShowChannels timeout'));
    }, 5000);

    function finish(err) {
      if (completed) {
        return;
      }

      completed = true;
      clearTimeout(timeout);

      if (socket && !socket.destroyed) {
        socket.end();
      }

      cb(err, activeLinkedids);
    }

    function cleanup(err) {
      if (socket && !socket.destroyed) {
        socket.destroy();
      }

      finish(err);
    }

    socket.on('connect', function () {
      socket.write(
        'Action: Login\r\n' +
        'Username: ' + amiConfig.user + '\r\n' +
        'Secret: ' + amiConfig.pass + '\r\n' +
        'Events: off\r\n\r\n'
      );
    });

    socket.on('data', function (chunk) {
      buffer += chunk.toString();

      while (buffer.indexOf('\r\n\r\n') !== -1) {
        var separatorIndex = buffer.indexOf('\r\n\r\n');
        var rawMessage = buffer.substring(0, separatorIndex);
        buffer = buffer.substring(separatorIndex + 4);

        if (!rawMessage.trim()) {
          continue;
        }

        var message = parseAmiMessage(rawMessage);

        if (!loggedIn) {
          if (message.response === 'Success') {
            loggedIn = true;
            socket.write(
              'Action: CoreShowChannels\r\n' +
              'ActionID: ' + actionId + '\r\n\r\n'
            );
          } else if (message.response === 'Error') {
            cleanup(new Error('AMI login failed: ' + (message.message || 'unknown error')));
          }
          continue;
        }

        if (message.actionid && message.actionid !== actionId) {
          continue;
        }

        if (message.event === 'CoreShowChannel' && message.linkedid) {
          activeLinkedids[message.linkedid] = activeLinkedids[message.linkedid] || [];
          activeLinkedids[message.linkedid].push(message);
        } else if (message.event === 'CoreShowChannelsComplete') {
          socket.write('Action: Logoff\r\n\r\n');
          finish(null);
        } else if (message.response === 'Error') {
          cleanup(new Error('AMI CoreShowChannels failed: ' + (message.message || 'unknown error')));
        }
      }
    });

    socket.on('error', function (err) {
      cleanup(err);
    });

    socket.on('end', function () {
      finish(null);
    });

  } catch (err) {
    cb(err);
  }
}

// Only a call still in progress is looked up on AMI, and a leg that started
// longer ago than this belongs to a call that has ended: a page of older calls
// does not open an AMI connection at all.
var LIVE_CALL_MAX_AGE_SECONDS = 12 * 3600;

function isRecentLeg(row) {
  var time = Number(row.time);
  return !isFinite(time) || time <= 0 || Date.now() / 1000 - time < LIVE_CALL_MAX_AGE_SECONDS;
}

function isAnsweredElsewhereCandidate(row) {
  return row &&
    row.linkedid &&
    isRecentLeg(row) &&
    (
      row.queue ||
      (typeof row.channel === 'string' && row.channel.indexOf('@from-queue-') !== -1) ||
      row.lastapp === 'Queue'
    ) &&
    ['NO ANSWER', 'BUSY', 'FAILED'].indexOf(row.disposition) !== -1;
}

// Whether a queue call still in progress was answered, and by whom, read from
// its channels: the CDR rows that say so are written only when the call ends.
// The caller sits in the Queue application of a queue whose "answered
// elsewhere" option is on, and once a member answers it shares a bridge with
// that member's Local channel.
function getQueueAnswer(channels, queues) {
  var answer = { answered: false, by: '' };
  channels.forEach(function (caller) {
    var queue = (caller.applicationdata || '').split(',')[0];
    if (caller.application !== 'Queue' || queues.indexOf(queue) === -1 || !caller.bridgeid) {
      return;
    }
    answer.answered = true;
    channels.forEach(function (member) {
      var match = /^Local\/([^@]+)@from-queue-/.exec(member.channel || '');
      if (match && member.bridgeid === caller.bridgeid) {
        answer.by = match[1];
      }
    });
  });
  return answer;
}

function promoteAnsweredElsewhereRows(results, queues, logger, idLog, cb) {
  try {
    if (!results || !Array.isArray(results.rows) || results.rows.length === 0 ||
      !queues || queues.length === 0) {
      cb(null, results);
      return;
    }

    var plainRows = results.rows.map(function (row) {
      if (row && typeof row.get === 'function') {
        return row.get({ plain: true });
      }
      if (row && row.dataValues) {
        return row.dataValues;
      }
      return row;
    });

    var candidateRows = plainRows.filter(isAnsweredElsewhereCandidate);
    if (candidateRows.length === 0) {
      cb(null, results);
      return;
    }

    getActiveLinkedids(function (err, activeLinkedids) {
      if (err) {
        logger.log.warn(idLog, 'failed to fetch active linkedids from AMI: ' + err.message);
        cb(null, results);
        return;
      }

      plainRows.forEach(function (row) {
        if (!activeLinkedids[row.linkedid] || !isAnsweredElsewhereCandidate(row)) {
          return;
        }
        var answer = getQueueAnswer(activeLinkedids[row.linkedid], queues);
        var member = /^Local\/([^@]+)@from-queue-/.exec(row.channel || '');
        // A member who missed a ring and answered a later one took the call himself.
        if (answer.answered && !(answer.by && member && member[1] === answer.by)) {
          row.disposition = 'ANSWERED_ELSEWHERE';
          row.normalized_disposition = 'ANSWERED_ELSEWHERE';
          if (answer.by && !row.answered_by_num) {
            row.answered_by_num = answer.by;
          }
        }
      });

      results.rows = plainRows;
      cb(null, results);
    });
  } catch (err) {
    cb(err);
  }
}

exports.promoteAnsweredElsewhereRows = promoteAnsweredElsewhereRows;
