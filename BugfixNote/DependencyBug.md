# Dealing with dependencies

Currently there is a known bug that upgrading uuid to 14 will crash the pos-backend.

Changing the dependency version usually need significant amount of refactoring while bringing little value. If the current version is working, don't change it unless you have strong reason to justify the effort.

Take pos-backend as an example, keeping uuid to be version 8 is a much safer choice.

