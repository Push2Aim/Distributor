const db = require("./db");
function getWeekOfWorkouts(arr) {
    let week = {};
    filterWeek(arr).forEach(w => {
        if (w.created_at) {
            week[w.created_at] = week[w.created_at] ||
                {duration: 0, amount: 0};
            week[w.created_at].duration += w.duration;
            week[w.created_at].amount++;
        }
    });
    let out = [];
    for (let day in week)
        out.push(week[day]);
    return out;
}
function filterWeek(arr) {
    let aWeekAgo = new Date();
    aWeekAgo.setDate(new Date().getDate() - 7);
    return arr.sort((a, b) => a.created_at - b.created_at)
        .filter(w => w.created_at >= aWeekAgo);
}
function filterMonth(arr) {
    let aWeekAgo = new Date();
    aWeekAgo.setDate(new Date().getDate() - 30);
    return arr.sort((a, b) => a.created_at - b.created_at)
        .filter(w => w.created_at >= aWeekAgo);
}
function buildStats(workouts, key) {
    let week = filterWeek(workouts);
    if (week.length <= 0) return [100, 100, 100, 100, 100, 100, 100];
    let max = week.map(w => w[key]).reduce((a, b) => Math.max(a, b));
    let out = week.map(w => 100 * w[key] / max);
    while (out.length < 7) out.push(0);
    return out
}
function getLastDrill(workouts) {
    return workouts[workouts.length - 1] ?
        workouts[workouts.length - 1].created_at : "Here is no Last Drill";
}
function buildUserProfile(senderID) {
    return db.getProfile(senderID).then(profile => {
        let workouts = profile.workouts;
        let xplogs = profile.xplogs;
        return ({
            workout_level: profile.workout_level,
            xp: profile.xp,
            days_being_on_fitness_journey: profile.days_being_on_fitness_journey,
            main_strength: profile.main_strength,
            user_goal: profile.days_being_on_fitness_journey,

            number_of_workouts: workouts.length,

            duration_avg_lifetime: average(workouts, "duration"),
            duration_max: max(getWeekOfWorkouts(workouts), "duration"),
            duration_heights: buildStats(workouts, "duration"), //the last 7 Day
            duration_last_drill: getLastDrill(workouts),
            duration_week_avg: average(filterWeek(workouts), "duration"),
            duration_month_avg: average(filterMonth(workouts), "duration"),

            amount_avg_lifetime: 2.1,
            amount_max: 22, //max(getWeekOfWorkouts(workouts), "amount"),
            amount_total: 23, //workouts.length,
            amount_this_week: 24, //filterWeek(workouts).length,
            amount_avg_week: 25, //average(getWeekOfWorkouts(workouts), "amount"),
            amount_heights: [10, 20, 30, 100], //the last 4 weeks

            xp_next_level: Math.pow(5 * 1.2, (profile.workout_level - 1)),
            xp_max: max(filterWeek(xplogs), "xp"),
            xp_heights: buildStats(xplogs, "xp"), //the last 7 Day
            xp_knowledge: profile.xp_knowledge,
            xp_drill: profile.xp_drill,
            xp_sharing: profile.xp_sharing,
        })
    })
}
function max(arr, key) {
    if (arr.length <= 0) return 0;
    return arr.reduce((a, b) => Math.max(a[key], b[key]))[key];
}
function average(arr, key) {
    if (arr.length <= 0) return 0;
    let sum = arr.map(w => w[key]).reduce((a, b) => a + b);
    return sum / arr.length;
}
module.exports = buildUserProfile;