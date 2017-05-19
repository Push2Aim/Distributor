const bookshelf = require('./bookshelf');
const User = require("./models/user");
const Profile = require("./models/profile");
const Workout = require("./models/workout");
const XpLog = require("./models/xplog");


module.exports = {
    updateProfile: updateProfile,
    addProfile: addProfile,
    getProfile: getProfile,
    getAllIDs: getAllIDs,
    addWorkout: addWorkout,
    getWorkouts: getWorkouts,
    addXp: addXp,
    getXps: getXps,
};
let addValues = function (from, to, keys) {
    keys.forEach(key => to[key] = from[key]);
    return to;
};
function getProfile(sessionId) {
    let parseUserProfile = function (profile) {
        let userProfile = parsProfile(profile.attributes)
        userProfile = addValues(profile.attributes, userProfile, ["created_at", "updated_at"]);
        userProfile.workouts = profile.related("workout").toJSON();
        userProfile.xplogs = profile.related("xplog").toJSON();
        console.log("got Profile", userProfile);
        return userProfile
    };
    return fetchProfile(sessionId)
        .then(profile => profile === null ?
            addProfile(sessionId, {}).then(getProfile(sessionId)) :
            parseUserProfile(profile))
        .catch(err => console.error("getProfile", err));
}
function fetchProfile(sessionId, columns = '*') {
    return Profile.where({fb_id: sessionId})
        .fetch({withRelated: ['workout', 'xplog'], columns: columns})
        .catch(err => addProfile(sessionId));
}
function addProfile(sessionId, context) {
    if(!sessionId) return Promise.reject(new Error("no sessionID"));

    let info = parsProfile(context);
    info.fb_id = sessionId;
    return Profile.forge(info, {hasTimestamps: true}).save()
        .then(profile => console.log("added Profile", profile))
        .catch(err => console.error("addProfile", err))
}
function updateProfile(sessionId, context) {
    if (getValidationError(context))
        return Promise.reject(getValidationError(context));

    let buildUpdate = () => {
        let update = parsProfile(context);
        update.updated_at = new Date();
        return update;
    };

    return Profile.where({fb_id: sessionId}).fetch()
        .then(profile => profile === null ?
            addProfile(sessionId, context) :
            profile.save(buildUpdate()))
        .then(profile => console.log("updated Profile", profile))
        .catch(err => console.error("updateProfile", err));
}
function parsProfile(context) {
    return {
        "workout_level": context.workout_level,
        "xp": context.xp,
        "main_strength": context.main_strength,
        "subscribed": context.subscribed,
        "user_goal": context.user_goal,

        xp_knowledge: context.xp_knowledge,
        xp_drill: context.xp_drill,
        xp_sharing: context.xp_sharing,
    }
}
function getValidationError(context) {
    if (Object.keys(context).length <= 0) return new Error("no Properties in context" + JSON.stringify(context));
    console.log("no ValidationError", context)
}
function whereWithArray(table, selector) {
    selector.forEach((cur) => cur.length === 2 ?
        table = table.where(cur[0], cur[1]) :
        table = table.where(cur[0], cur[1], cur[2])
    );
    return table;
}
function select(table, selector) {
    return (Array.isArray(selector) ?
        whereWithArray(table, selector) : table.where(selector));
}
function getAllIDs(selectors) {
    try {
        let out = selectors.map((selector) =>
            select(Profile, selector).fetchAll()
                .then(profiles => profiles.map(profile => profile.get("fb_id")))
        );

        return Promise.all(out).then(ids => {
            return ids.reduce((acc, cur) => {
                cur.forEach(id => acc.includes(id) ? acc : acc.push(id))
                return acc
            });
        }).catch(err => console.error("getAllIDs", err));
    } catch (err) {
        return Promise.reject("Error on getAllIDs: " + err)
    }
}

function parsWorkout(context = {}) {
    return {
        duration: context.duration || 30,
        location: context.location || "home",
    }
}
function addWorkout(sessionId, context) {
    if (!sessionId) return Promise.reject(new Error("no sessionID"));

    let info = parsWorkout(context);
    return fetchProfile(sessionId).then(profile => {
        info.profile_id = profile.id;
        return Workout.forge(info, {hasTimestamps: true}).save()
            .then(workout => console.log("added Workout", workout))
            .catch(err => console.error("addWorkout", err))
    })
}
function getWorkouts(sessionId) {
    if (!sessionId) return Promise.reject(new Error("no sessionID"));

    return Profile.where({fb_id: sessionId}).fetch({withRelated: ['workout']})
        .then(profile => profile.related('workout').toJSON());
}

function parsXp(context = {}) {
    return {
        xp: context.xp || 0,
    }
}
function getXps(sessionId) {
    if (!sessionId) return Promise.reject(new Error("no sessionID"));

    return Profile.where({fb_id: sessionId}).fetch({withRelated: ['xplog']})
        .then(profile => profile.related('xplog').toJSON());
}
function addXp(sessionId, context) {
    if (!sessionId) return Promise.reject(new Error("no sessionID"));

    let buildUpdate = (old) => {
        let update = parsXp(context);
        update.updated_at = new Date();
        update.xp += old.attributes.xp;
        return update;
    };

    function buildNew(context, profile) {
        let info = parsXp(context);
        info.profile_id = profile.id;
        return info;
    }

    return fetchProfile(sessionId, 'id').then(profile => {
        return XpLog.where({profile_id: profile.id})
            .orderBy('created_at', 'DESC')
            .fetch()
            .then(xpLog => xpLog && xpLog.attributes.created_at.toDateString()
                == new Date().toDateString() ?
                xpLog.save(buildUpdate(xpLog)) :
                XpLog.forge(buildNew(context, profile), {hasTimestamps: true}).save())
            .then(xp => console.log("added Xp", xp))
            .catch(err => console.error("addXp", err))
    })
}