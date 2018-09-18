
function findLastEvent(lst) {
    let num = ev => ev.event.transactionIndex*10 + ev.event.logIndex + ev.event.blockNumber*100000000
    let copy = lst.concat()
    copy.sort((a,b) => num(a) < num(b))
    return copy[0]
}

module.exports.analyze = async function (account, events, recoverTask, recoverGame, disputeResolutionLayer, incentiveLayer, game_list, task_list) {
    // Sort them based on task ids and disputation ids
    let task_evs = {}
    let game_evs = {}
    let tasks = []
    let games = []
    for (let i = 0; i < events.length; i++) {
        let ev = events[i]
        let taskid = ev.event.args.taskID
        let gameid = ev.event.args.gameID
        if (taskid) {
            let num = (await incentiveLayer.getBondedDeposit(taskid, account)).toNumber()
            if (num > 0) {
                if (!task_evs[taskid]) {
                    tasks.push(taskid)
                    task_evs[taskid] = []
                }
                task_evs[taskid].push(ev)
            }
        }
        if (gameid) {
            // console.log("Found", ev.event.event, "for", gameid)
            let actor = await disputeResolutionLayer.getProver.call(gameid)
            if (actor.toLowerCase() == account.toLowerCase()) {
                if (!game_evs[gameid]) {
                    games.push(gameid)
                    game_evs[gameid] = []
                }
                game_evs[gameid].push(ev)
            }
        }
    }
    // for each task, check if it has ended, otherwise handle last event and add it to task list
    // TODO: also check that all verification games have started properly ??
    for (let i = 0; i < tasks.length; i++) {
        let id = tasks[i]
        let evs = task_evs[id]
        if (evs.some(a => a.event.event == "TaskFinalized")) return
        task_list.push(id)

        await recoverTask(id)

        let last = findLastEvent(evs)
        console.log("Handling to recover:", last.event)
        await last.handler(last.event)
    }
    // for each game, check if it has ended, otherwise handle last event and add it to game list
    for (let i = 0; i < games.length; i++) {
        let id = games[i]
        let evs = game_evs[id]

        if (evs.some(a => a.event.event == "WinnerSelected")) return
        game_list.push(id)

        await recoverGame(id)

        let last = findLastEvent(evs)
        console.log("Handling to recover:", last.event)
        await last.handler(last.event)
    }
    console.log("Tasks", task_list, "Games", game_list)
}

