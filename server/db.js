const User = require("./models/user");
const Profile = require("./models/profile");

module.exports = {
    updateProfile: updateProfile,
    addProfile: addProfile,
    getProfile: getProfile,
    getAllIDs: getAllIDs
};
let addValues = function (from, to, keys) {
    keys.forEach(key => to[key] = from[key]);
    return to;
};
function getProfile(sessionId) {
    let parseUserProfile = function (profile) {
        let userProfile = parsProfile(profile.attributes)
        userProfile = addValues(profile.attributes, userProfile, ["created_at", "updated_at"]);
        console.log("got Profile", userProfile);
        return userProfile
    };
    return Profile.where({fb_id: sessionId}).fetch()
        .then(profile => profile === null ?
            addProfile(sessionId, {}).then(getProfile(sessionId)) :
            parseUserProfile(profile))
        .catch(err => console.error("getProfile", err));
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
    if (!getValidationError(context))
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
        "number_of_workouts": context.number_of_workouts,
        "workout_level": context.workout_level,
        "ep": context.ep,
        "main_strength": context.main_strength,
        "days_being_on_fitness_journey": context.days_being_on_fitness_journey,
        "subscribed": context.subscribed,
        "user_goal": context.user_goal,
    }
}
function getValidationError(context) {
    if (Object.keys(context).length <= 0) return new Error("no Properties in context" + JSON.stringify(context));
    console.log("no ValidationError", context)
}
function getAllIDs(selectors) {
    return Profile.where(selectors).fetchAll({require: true})
        .then(profiles => profiles.map(profile => profile.get("fb_id")))
        .then(ids => {
            console.log("got fb_ids", ids);
            return ids;
        })
        .catch(err => console.error("getAllIDs", err));
}