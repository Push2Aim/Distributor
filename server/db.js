const User = require("./models/user");
const Profile = require("./models/profile");

module.exports = {
    updateProfile: updateProfile,
    addProfile: addProfile
};
function addProfile(sessionId, context) {
    let info = buildUpdate(context);
    info.fb_id = sessionId;
    return Profile.forge(info, {hasTimestamps: true}).save()
        .then(profile => console.log("added Profile", profile))
        .catch(err => console.error("addProfile", err))
}
function updateProfile(sessionId, context) {
    if (Object.keys(context).length <= 0) return console.log("no Info to Update", context);
    else console.log("update with ", context);

    return Profile.where({fb_id: sessionId}).fetch()
        .then(profile => profile === null ?
            addProfile(sessionId, context) :
            profile.save(buildUpdate(context)))
        .then(profile => console.log("updated Profile", profile))
        .catch(err => console.error("updateProfile", err));
}
function buildUpdate(context) {
    return {
        "updated_at": new Date(),
        "number_of_workouts": context.number_of_workouts,
        "workout_level": context.workout_level,
        "ep": context.ep,
        "main_strength": context.main_strength,
        "days_being_on_fitness_journey": context.days_being_on_fitness_journey,
        "subscribed": context.subscribed,
        "goal": context.goal,
    }

}