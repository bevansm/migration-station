## PHPBB3 to PHPBB3 Migration

A PHPBB3 to PHPBB3 migration tool heavily inspired by the python crawlers at https://www.phpbb.com/community/viewtopic.php?f=65&t=1761395. This only supports a subset of features, but does provide avenues to navigate around issues like gcaptcha logins & custom nested forums.

This will recursively migrate everything from the given base URL to the given destination forum/subforum (to ease the migration of dependant communities), and will only map over users who have posted in the given forum.

Note that this can produce a large amount of output data.
