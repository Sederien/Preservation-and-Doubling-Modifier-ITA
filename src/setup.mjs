const perservationChanceMultiplierName = 'preservation-multiplier';
const overrideAncientRelicGamemodePreservationModifier = 'override-preservation';
const doublingChanceMultiplierName = 'doubling-multiplier';
const overrideAncientRelicGamemodeDoublingModifier = 'override-doubling';
const enableAncientRelicOverrideAfterDungeon = 'enable-ancient-relic-override'

const ancientRelicDecreaseModifier = 696969;
const settingsGeneralSection = 'General';
const settingsAncientRelicsSection = 'Ancient Relics Overrides';

const double = "Double";
const double_l = "double";
const preserve = "Preserve";
const preservation = "Preservation";

let doublingModifiers;
let preservationModifiers;

let isPreservationPatched = false;
let isDoublingPatched = false;

export function setup(ctx) {
    isPreservationPatched = false;
    isDoublingPatched = false;
    ctx.onCharacterLoaded(OnCharacterLoaded);
    ctx.onModsLoaded(onModsLoaded);
}

async function onModsLoaded(ctx) {
    ctx.settings.section(settingsGeneralSection).add([{
        type: 'number',
        name: perservationChanceMultiplierName,
        label: 'Preservation Chance Multiplier',
        hint: 'A multiplier applied to your preservation chance (max preservation chance = 80%)',
        default: 1,
        min: 0,
        max: 5,
    },
    {
        type: 'number',
        name: doublingChanceMultiplierName,
        label: 'Doubling Chance Multiplier',
        hint: 'A multiplier applied to your doubling chance (max doubling chance = 100%)',
        default: 1,
        min: 0,
        max: 5
    }]);

    ctx.settings.section(settingsAncientRelicsSection).add([{
        type: 'switch',
        name: overrideAncientRelicGamemodePreservationModifier,
        label: 'Override Ancient Relic Preservation Rule',
        hint: 'If true, enables regular preservation in the Ancient Relic game mode',
        default: false,
        onChange: PreservationChangedEvent
    },
    {
        type: 'switch',
        name: overrideAncientRelicGamemodeDoublingModifier,
        label: 'Override Ancient Relic Doubling Rule',
        hint: 'If true, enables regular doubling in the Ancient Relic game mode',
        default: false,
        onChange: DoublingChangedEvent
    },
    {
        type: 'dropdown',
        name: enableAncientRelicOverrideAfterDungeon,
        label: 'Enable Ancient Relic Override After Dungeon',
        hint: 'Allows you to choose a dungeon after which the ancient relic overrides are enabled. This allows you to have to work for your preservation and/or doubling',
        default: 'none',
        options: GetDungeonOptions(),
        onChange: DungeonChangedEvent
    }]);

    ctx.patch(Skill, 'getDoublingChance').after(chance => {
        return chance * GetDoublingModifier();
    })

    ctx.patch(Skill, 'getPreservationChance').after(chance => {
        return chance * GetPreservationModifier();
    })
}

function GetDungeonOptions() {
    var options = [
        {
            value: 'none',
            display: 'None'
        }
    ];

    game.dungeons.allObjects.forEach(dungeon => {
        options.push({
            value: dungeon._namespace.name + ':' + dungeon._localID,
            display: dungeon._name
        });
    });

    return options;
}

function Log(message) {
    console.log('[PADM] ' + message);
}

async function OnCharacterLoaded(ctx) {
    if (IsAncientRelicsGamemode()) {
        doublingModifiers = game.currentGamemode.disabledModifiers.filter(el => {
            return el.includes(double) || el.includes(double_l);
        })
        preservationModifiers = game.currentGamemode.disabledModifiers.filter(el => {
            return el.includes(preservation) || el.includes(preserve);
        })

        ctx.patch(CombatManager, 'addDungeonCompletion').after(dungeon => {
            OverridePreservation(CurrentSetPreservationOverride(), HasPlayerCompletedCurrentlySetDungeon());
            OverrideDoubling(CurrentSetDoublingOverride(), HasPlayerCompletedCurrentlySetDungeon());
        })

        OverridePreservation(CurrentSetPreservationOverride(), HasPlayerCompletedCurrentlySetDungeon());
        OverrideDoubling(CurrentSetDoublingOverride(), HasPlayerCompletedCurrentlySetDungeon());
    }
}

function IsAncientRelicsGamemode() {
    return game.currentGamemode._localID === 'AncientRelics';
}

function GetDoublingModifier() {
    let modifier = GetContext().settings.section(settingsGeneralSection).get(doublingChanceMultiplierName);
    if (modifier === undefined) {
        modifier = 1;
    }
    return modifier;
}

function GetPreservationModifier() {
    let modifier = GetContext().settings.section(settingsGeneralSection).get(perservationChanceMultiplierName);
    if (modifier === undefined) {
        modifier = 1;
    }
    return modifier;
}

function DungeonChangedEvent(current, previous) {
    OverridePreservation(CurrentSetPreservationOverride(), HasPlayerCompletedDungeon(current));
    OverrideDoubling(CurrentSetDoublingOverride(), HasPlayerCompletedDungeon(current));
}

function PreservationChangedEvent(current, previous) {
    OverridePreservation(current, HasPlayerCompletedCurrentlySetDungeon());
}

function DoublingChangedEvent(current, previous) {
    OverrideDoubling(current, HasPlayerCompletedCurrentlySetDungeon());
}

function HasPlayerCompletedDungeon(dungeon) {
    if (dungeon === 'none') {
        return true;
    }

    return game.combat.getDungeonCompleteCount(game.dungeons.getObjectByID(dungeon)) > 0
}

function GetContext() {
    return mod.getContext(import.meta);
}

function CurrentSetPreservationOverride() {
    return GetContext().settings.section(settingsAncientRelicsSection).get(overrideAncientRelicGamemodePreservationModifier);
}

function CurrentSetDoublingOverride() {
    return GetContext().settings.section(settingsAncientRelicsSection).get(overrideAncientRelicGamemodeDoublingModifier);
}

function CurrentSetDungeonID() {
    return GetContext().settings.section(settingsAncientRelicsSection).get(enableAncientRelicOverrideAfterDungeon);
}

function HasPlayerCompletedCurrentlySetDungeon() {
    return HasPlayerCompletedDungeon(CurrentSetDungeonID());
}

function SetDisabledModifiers(preservation, doubling) {
    let newArray = [];

    if (!preservation) {
        newArray = newArray.concat(preservationModifiers);
    }
    if (!doubling) {
        newArray = newArray.concat(doublingModifiers);
    }

    game.currentGamemode.disabledModifiers = newArray;
}

function OverridePreservation(preservation, dungeon) {
    if (!IsAncientRelicsGamemode()) {
        return;
    }

    const enable = preservation && dungeon;

    if (enable === isPreservationPatched) {
        return;
    }

    isPreservationPatched = enable;

    if (enable) {
        game.currentGamemode.disablePreservation = false;

        game.modifiers.decreasedAltMagicRunePreservation -= ancientRelicDecreaseModifier;
        game.modifiers.decreasedAmmoPreservation -= ancientRelicDecreaseModifier;
        game.modifiers.decreasedChanceToPreservePotionCharge -= ancientRelicDecreaseModifier;
        game.modifiers.decreasedChanceToPreservePrayerPoints -= ancientRelicDecreaseModifier;
        game.modifiers.decreasedGlobalPreservationChance -= ancientRelicDecreaseModifier;
        game.modifiers.decreasedRunePreservation -= ancientRelicDecreaseModifier;
        game.modifiers.decreasedSummoningChargePreservation -= ancientRelicDecreaseModifier;

        game.currentGamemode.playerModifiers.decreasedAltMagicRunePreservation -= ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedAmmoPreservation -= ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedChanceToPreservePotionCharge -= ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedChanceToPreservePrayerPoints -= ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedGlobalPreservationChance -= ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedRunePreservation -= ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedSummoningChargePreservation -= ancientRelicDecreaseModifier;
    } else {
        game.currentGamemode.disablePreservation = true;

        game.modifiers.decreasedAltMagicRunePreservation += ancientRelicDecreaseModifier;
        game.modifiers.decreasedAmmoPreservation += ancientRelicDecreaseModifier;
        game.modifiers.decreasedChanceToPreservePotionCharge += ancientRelicDecreaseModifier;
        game.modifiers.decreasedChanceToPreservePrayerPoints += ancientRelicDecreaseModifier;
        game.modifiers.decreasedGlobalPreservationChance += ancientRelicDecreaseModifier;
        game.modifiers.decreasedRunePreservation += ancientRelicDecreaseModifier;
        game.modifiers.decreasedSummoningChargePreservation += ancientRelicDecreaseModifier;

        game.currentGamemode.playerModifiers.decreasedAltMagicRunePreservation += ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedAmmoPreservation += ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedChanceToPreservePotionCharge += ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedChanceToPreservePrayerPoints += ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedGlobalPreservationChance += ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedRunePreservation += ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedSummoningChargePreservation += ancientRelicDecreaseModifier;
    }

    SetDisabledModifiers(enable, isDoublingPatched);
}

function OverrideDoubling(doubling, dungeon) {
    if (!IsAncientRelicsGamemode()) {
        return;
    }

    const enable = doubling && dungeon;

    if (enable == isDoublingPatched) {
        return;
    }

    isDoublingPatched = enable;

    if (enable) {
        game.currentGamemode.disableItemDoubling = false;

        game.modifiers.decreasedChanceDoubleHarvest -= ancientRelicDecreaseModifier;
        game.modifiers.decreasedChanceToDoubleItemsGlobal -= ancientRelicDecreaseModifier;
        game.modifiers.decreasedChanceToDoubleLootCombat -= ancientRelicDecreaseModifier;
        game.modifiers.decreasedChanceToDoubleOres -= ancientRelicDecreaseModifier;

        game.currentGamemode.playerModifiers.decreasedChanceDoubleHarvest -= ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedChanceToDoubleItemsGlobal -= ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedChanceToDoubleLootCombat -= ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedChanceToDoubleOres -= ancientRelicDecreaseModifier;
    } else {
        game.currentGamemode.disableItemDoubling = true;

        game.modifiers.decreasedChanceDoubleHarvest += ancientRelicDecreaseModifier;
        game.modifiers.decreasedChanceToDoubleItemsGlobal += ancientRelicDecreaseModifier;
        game.modifiers.decreasedChanceToDoubleLootCombat += ancientRelicDecreaseModifier;
        game.modifiers.decreasedChanceToDoubleOres += ancientRelicDecreaseModifier;

        game.currentGamemode.playerModifiers.decreasedChanceDoubleHarvest += ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedChanceToDoubleItemsGlobal += ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedChanceToDoubleLootCombat += ancientRelicDecreaseModifier;
        game.currentGamemode.playerModifiers.decreasedChanceToDoubleOres += ancientRelicDecreaseModifier;
    }

    SetDisabledModifiers(isPreservationPatched, enable);
}