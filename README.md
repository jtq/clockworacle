# Clockwork Oracle

A mod for Sunless Sea by Failbetter Games

* [Players](#players)
* [Modders/Developers](#sunless-sea-moddersdevelopers)

## Introduction

**New players!**  Tired of dying needlessly because you didn't know it was a bad idea to poke a flock of harmless-looking blue birds?

**Veteran Zee-captains!** Bored of sailing endlessly in circles because you can't remember where to find a lump of Blue Scintillack for that one quest you're stuck on?

Sick of constantly having to slink back to [the wiki](http://sunlesssea.gamepedia.com/) or face hours of grinding and pointless, unnecessary deaths?  (Pointy *necessary* deaths, of course, still being very much encouraged on the Sunless Sea, and rightly so).

*We feel your pain.*

##### Introducing

### The Clockwork Oracle

A most wonderful ~~Demonic~~ *Mechanical* Contrivance, fresh from the engineering workshops of Messirs Faust and Fhlanje of Fallen London, Royal Occultarians and Gizmographers to the Gentry.

It *knows* Things.  If you ask it, it will Tell you.

It will Never Lie to you, but you will Remain Told.  Possibly to Death.


<sub>Messirs Faust and Fhlange disclaim to the fullest extend permissable by Law and Civility (and then about ten percent further again) any and all Responsibility, Inferred or Implied, for any effects on the user's Sanity, Character, Mortal Status, Personality, Psychological Stability Physical Stability or Vital Statistics incurred as a Consequence of consulting the Aforementioned Product.</sub>

<sub>Clockwork Oracle is not to be used for Prognostication, Augury or Panupunitoplasty.  Any resemblance to Real Persons, Living or Dead, is probably Significant but wisest to Ignore. Do not Taunt the Clockwork Oracle.  Warranty void if Clockwork Oracle consulted.</sub>

## Players

### Installing the mod

[Download the release version of the mod](https://github.com/jtq/clockworacle/raw/master/release/clockworacle-mod.zip).

#### Find your Sunless Sea game-data directory

On Windows this is normally `C:\Users\USERNAME\AppData\LocalLow\Failbetter Games\Sunless Sea` (fill in your installation drive letter and Windows username as appropriate).

If you can't find it there, try going to your user's home directory and searching in subdirectories for a folder called `Sunless Sea`.


#### Install the mod files

There should be a folder under your game-data directory called `addons` - create it if it doesn't exist already.

Now unzip the mod files into this folder - it should automatically create a subdirectory called `clockworacle`.

That's it - you're done.  Enjoy!

#### Run Sunless Sea

If you look around Fallen London you should see a new event that involves travelling to a mysterious little shop.

Once you have acquired the Clockwork Oracle you will be able to go into your hold in the game at any time, right-click on the Clockwork Oracle item and click "Use" from the menu to consult the Clockwork Oracle for hints on acquiring a wide variety of qualities, attributes, trade goods, characteristics and quest-items in the Neath.

The directions are always truthful, but may be misleading, confusing or incomplete.  That's what happens when you let clockwork do your thinking for you.  Or possibly a bound demon in a box that hates you and wants you to die.  Nobody knows exactly which.


## Sunless Sea Modders/Developers

### Installation

* Download and unzip the [precompiled mod-tools](https://github.com/jtq/clockworacle/raw/master/release/modtools.zip).
* Find your Sunless Sea game-data directory (using the instructions for Players above), and copy each of the `.json` files contained in the various subdirectories of your Sunless Sea game-data directory **directly** into the `modtools\game-data\json` directory (ie, the only thing in the `modtools\game-data\json` directory should be `.json` files - no subdirectories allowed).
* Now in your Sunless Sea game-data directory open the `images\sn\icons` folder and copy the entire contents into the `modtools\game-data\icons` folder.
* Open the `modtools\index.html` file in your browser (only tested in Chrome so far, but should probably work in others).  Opening it straight from a `file:///...` URL should work fine.
* Select all the json files in your game-data/json folder, and drag-and-drop them **all at once** onto the square in the web UI.

### UI

#### Exploring the basic object-types

After a few seconds (we're chewing through megabytes of text in a browser here!) your UI should unfreeze.  From here you can use the tabs to switch between several of the fundamental types of objects available in the Sunless Sea game - Events (things that can happen in the Gazette view), Qualities (attributes on your character that are set/incremented/decremented to lock/unlock various game events and interactions, SpawnedEntities (monsters in the game-world), etc.

If an item has "children" (eg, the various interaction choices offered as part of an Event) then clicking on the item will expand it to show these children (and so on for each child), allowing you to explore the game's storylines and event-sequences.

Mouse-hover tooltips always try to give you a concise description of the item you're looking at, for easy reference when exploring/debugging.

#### Query tab/Paths to node form

The last tab is the `Query` tab - this is used for quickly and easily finding all the routes through the various game events/interactions that will lead to a certain quality being modified or event being triggered.

To demonstrate its use, pick a Quality to search for - let's say "A Casket of Sapphires" (id #113012, according to its tooltip in the Qualities tab).

Look at the top of the page, and make sure the Qualities/Events dropdown is set to "1. Qualities".  Next you can select the type of modification you'd like to search for for the chosen Quality - "additive" means any path that acquires the quality or increments its value, "subtractive" means losing the quality or decremening its value, and "Any/None" means either.  In game-terms, "additive" is roughly "how to get an item or attribute", ands "subtractive" is broadly "what it's useful for or how to get rid of it".

Finally click on the `Paths to node` button, type in the ID of the "A Casket of Sapphires" quality (113012), and click `ok`.

The `Query` tab should now show you a selection of trees of nodes, each rooted in a QualityEffect node that modifies the A Casket of Sapphires quality, with each leaf node generally something you can intentionally choose to do in the game, like an Area you can visit, a SpawnedEntity you can find, an Event you can trigger or an Exchange you can visit in a Port.

The way to read these trees is to pick a leaf, then work your way back up the tree - for example if you chose Any/None then the first path will be:

* A Casket of Sapphires -7 (QualityEffect)
    * "Something azure." (Interaction)
        * The Venturer's Desires (Event)
            * Fallen London (Area)

This corresponds to a sequence that should (hopefully) be achievable by the player - in this case travel to Fallen London and dock there, Trigger the Venturer's Desires Event, Select the option "Something azure" when prompted, and 7 Caskets of Sapphires will be deducted from your hold.

Each of these steps may have their own Quality Requirements - look them up in the appropriate tab for the full details required for each step of the chain.

Finally, below the path you should see an auto-generated hint and flattened/summarised list of Quality Requirements that represents the option the Clockwork Oracle mod will display for this path.

(Note that presently the Clockwork Oracle mod only offers additive paths in-game - subtractive paths are currently offered only by the UI, for debugging/exploration purposes.)

## Final Notes

Compiled and up to date as of:

* Sunless Sea v1.0.4.2130
* The Rose Market update (28th January 2016: http://steamcommunity.com/games/304650/announcements/detail/954003578980280207)

Fallen London is © 2015 and ™ Failbetter Games Limited: [www.fallenlondon.com](http://www.fallenlondon.com).  This is an unofficial fan work.
