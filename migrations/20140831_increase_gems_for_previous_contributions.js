// IMPORTANT:
//
// run like this to capture all output:
//
// node 20140831_increase_gems_for_previous_contributions.js  > 20140831_increase_gems_for_previous_contributions_output.txt


var migrationName = '20140831_increase_gems_for_previous_contributions';

/**
 * https://github.com/HabitRPG/habitrpg/issues/3933
 * Increase Number of Gems for Contributors
 * author: Alys (d904bd62-da08-416b-a816-ba797c9ee265)
 * 
 * Increase everyone's gems per their contribution level.
 * Originally they were given 2 gems per tier.
 * Now they are given 3 gems per tier for tiers 1,2,3
 *                and 4 gems per tier for tiers 4,5,6,7
 * So that means an EXTRA 1 for tier 1,
 *                        2 for tier 2,
 *                        3 for tier 3,
 *                        5 for tier 4,
 *                        7 for tier 5,
 *                        9 for tier 6,
 *                       11 for tier 7,
 *                       11 for tier 8 (moderators = tier 7 + admin privileges),
 *                     none for tier 9 (staff)
 */

var mongo = require('mongoskin');
var _ = require('lodash');


///////////////////    UNCOMMENT ONE OF THESE LINES:    ///////////////////
// var dbUsers = mongo.db('lefnire:mAdn3s5s@charlotte.mongohq.com:10015/habitrpg_large?auto_reconnect').collection('users'); // @lefnire habitrpg_large
// var dbUsers = mongo.db('localhost:27017/habitrpg_old?auto_reconnect').collection('users'); // @lefnire habitrpg_old
// var dbUsers = mongo.db('localhost:27017/habitrpg?auto_reconnect').collection('users'); // for local testing by script author (e.g., vagrant install)
if (typeof dbUsers == 'undefined') { exiting(1, 'Uncomment one of the "var dbUsers" lines!'); }


var query = { $and: [
    { 'migration': {$ne: migrationName} },
    { 'contributor.level': {$gt: 0} },
    { 'contributor.level': {$lt: 9} }
]};

var fields = {'migration':1,
    'contributor.level':1,
    'auth.local.username':1,
    'balance':1,
};

var userResults = {}; // each key is a UUID, each value is a string
                      // describing what changed for that user

console.warn('Updating users...');
var progressCount = 50;
var count = 0;
dbUsers.findEach(query, fields, {batchSize:250}, function(err, user) {
    if (err) { return exiting(1, 'ERROR! ' + err); }
    if (!user) {
        console.warn('All users found. Fetching final balances...');
        return fetchFinalBalances();
    }
    count++;

    var set = {'migration': migrationName};

    var tier = user.contributor.level;
    var extraGems = tier; // tiers 1,2,3
    if (tier > 3)  { extraGems = 3 + (tier - 3) * 2; }
    if (tier == 8) { extraGems = 11; }
    extraBalance = extraGems / 4;
    set['balance'] = user.balance + extraBalance;

    // Capture current state of user:
    userResults[user._id] =
        user._id + '  ' + user.auth.local.username + ':\n' +
        '  contrib tier          :  ' + tier + '\n' +
        '  balance before        :  ' + user.balance + '\n' +
        '  balance (gems) added  :  ' + extraBalance + ' (' +
                                        extraGems + ')' + '\n' +
        '  expected balance after:  ' + (user.balance + extraBalance) + '\n';

    // Update user:
    dbUsers.update({_id:user._id}, {$set:set, $inc:{_v:1}});
    if (count%progressCount == 0) console.warn(count + ' ' + user._id);
});


function fetchFinalBalances() {
    var query = {_id: {$in: Object.keys(userResults)}};
    var fields = {
        'auth.local.username':1,
        'balance':1,
    };

    var count1 = 0;
    dbUsers.findEach(query, fields, {batchSize:250}, function(err, user) {
        if (err) { return exiting(1, 'ERROR! ' + err); }
        if (!user) {
            console.warn('All final balances found.');
            return displayData();
        }
        count1++;
        userResults[user._id] = userResults[user._id] +
            user._id + '  ' + user.auth.local.username + ':\n' +
            '  actual balance after  :  ' + user.balance + '\n';
        if (count1%progressCount == 0) console.warn(count1 + ' ' + user._id);
    });
}


function displayData() {
    _.each(userResults, function(text, uuid) {
        console.log(text); // text contains uuid
    });
    console.log('\n' + count +
            ' users processed (should be roughly 335 according to the Hall)\n');
    return exiting(0);
}


function exiting(code, msg) {
    code = code || 0; // 0 = success
    if (code && !msg) { msg = 'ERROR!'; }
    if (msg) {
        if (code) { console.error(msg); }
        else      { console.log(  msg); }
    }
    process.exit(code);
}
