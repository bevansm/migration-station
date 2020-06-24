# PHPBB3 to PHPBB3 Migration

A PHPBB3 to PHPBB3 migration tool heavily inspired by the python crawlers at https://www.phpbb.com/community/viewtopic.php?f=65&t=1761395. This only supports a subset of features, but does provide avenues to navigate around issues like gcaptcha logins & custom nested forums.

This will recursively migrate everything from the given base URL to the given destination forum/subforum (to ease the migration of dependant communities), and will only map over users who have posted in the given forum.

Note that this can produce a large amount of output data, and will generate a high volume of calls to an outbound forum. Requests are currently limited to 1/0.5s. You can tweak these values in the PHPBBClient.

I'm using an external library for bbcode parsing. A workaround for better, "pure" parsing is to hit the endpoint to quote a post, quote said post, grab the raw, pre-prettified bbcode there, and then perform mapping magic. This will increase the volume of outgoing calls, but is a much, much cleaner way to do it.

## Use

This code is somewhat specialized for our usecase, which was exporting a single subforum (with no dependents) from a phpbb forum. Hence, there are no guarentees that this code is bug-free. Treat it as a POC.

1. Fill out the env file as appropriate
2. Run this script to generate users, forum data, ect.
3. Jam the resulting SQL commands through phpadmin
4. Navigate to the Admin Control Panel (ACP) and sync forum stats.
