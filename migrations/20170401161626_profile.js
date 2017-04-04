exports.up = function (knex, Promise) {
    return knex.schema.createTable("profile", function (table) {
        table.increments().primary();
        table.biginteger("fb_id").notNullable().unique();
        table.integer("number_of_workouts");
        table.integer("workout_level");
        table.biginteger("ep");
        table.string("main_strength");
        table.integer("days_being_on_fitness_journey");
        table.boolean("subscribed");
        table.string("user_goal");
        table.timestamps();
    });
};

exports.down = function (knex, Promise) {
    return knex.schema.dropTable("profile");
};
