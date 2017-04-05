exports.up = function (knex, Promise) {
    return knex.schema.createTableIfNotExists("profile", function (table) {
        table.increments().primary();
        table.biginteger("fb_id").notNullable().unique();
        table.integer("number_of_workouts").defaultTo(0);
        table.integer("workout_level").defaultTo(0);
        table.biginteger("ep").defaultTo(0);
        table.string("main_strength").defaultTo("started");
        table.integer("days_being_on_fitness_journey").defaultTo(0);
        table.boolean("subscribed").defaultTo(false);
        table.string("user_goal").defaultTo("else");
        table.timestamps();

        console.log("created Table", table)
    });
};

exports.down = function (knex, Promise) {
    return knex.schema.dropTable("profile");
};
