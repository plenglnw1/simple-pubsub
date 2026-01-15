// interfaces
interface IEvent {
  type(): string;
  machineId(): string;
}

interface ISubscriber {
  handle(event: IEvent): void;
  addMachine(machine: Machine): void;
  removeMachine(machine: Machine): void;
}

interface IPublishSubscribeService {
  publish(event: IEvent): void;
  subscribe(type: string, handler: ISubscriber): void;
  unsubscribe(type: string, handler: ISubscriber): void;
}

class PublishSubscribeService implements IPublishSubscribeService {
  private readonly _subscribers: Map<string, ISubscriber[]>;

  constructor() {
    this._subscribers = new Map<string, ISubscriber[]>();
  }

  // publish an event based on IEvent
  publish(event: IEvent): void {
    // check null
    if (!this._subscribers.has(event.type())) {
      return;
    }
    const handlers = this._subscribers.get(event.type()) || [];
    handlers.forEach((handler) => handler.handle(event));
    // this._subscribers.get(event.type()).forEach(handler => handler.handle(event));
  }

  // add reference of handler to dictionary based on event type
  subscribe(type: string, handler: ISubscriber): void {
    if (!this._subscribers.has(type)) {
      this._subscribers.set(type, []);
    }
    this._subscribers.get(type)?.push(handler);
  }

  // remove reference of handler from dictionary based on event type
  unsubscribe(type: string, handler: ISubscriber): void {
    if (!this._subscribers.has(type)) {
      return;
    }
    const handlers = this._subscribers.get(type);
    this._subscribers.set(type, handlers?.filter((h) => h !== handler) || []);
  }
}

// implementations
class MachineSaleEvent implements IEvent {
  private readonly _sold: number;
  private readonly _machineId: string;
  constructor(sold: number, machineId: string) {
    this._sold = sold;
    this._machineId = machineId;
  }

  machineId(): string {
    return this._machineId;
  }

  getSoldQuantity(): number {
    return this._sold;
  }

  type(): string {
    return "sale";
  }
}

class MachineRefillEvent implements IEvent {
  private readonly _refill: number;
  private readonly _machineId: string;
  constructor(refill: number, machineId: string) {
    this._refill = refill;
    this._machineId = machineId;
  }

  machineId(): string {
    return this._machineId;
  }

  getRefillQuantity(): number {
    return this._refill;
  }

  type(): string {
    return "refill";
  }
}

class MachineSaleSubscriber implements ISubscriber {
  private machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  public getMachines(): Machine[] {
    return this.machines;
  }

  public addMachine(machine: Machine): void {
    this.machines.push(machine);
  }

  public removeMachine(machine: Machine): void {
    this.machines = this.machines.filter((m) => m.id !== machine.id);
  }

  handle(event: IEvent): void {
    const machineIndex = this.machines.findIndex(
      (m) => m.id === event.machineId()
    );
    if (machineIndex === -1) {
      return;
    }
    if (event instanceof MachineSaleEvent) {
      this.machines[machineIndex].stockLevel -= event.getSoldQuantity();
      console.log(
        `Machine ${event.machineId()} sold ${event.getSoldQuantity()} units`
      );
    }
  }
}

class MachineRefillSubscriber implements ISubscriber {
  private machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  public getMachines(): Machine[] {
    return this.machines;
  }

  public addMachine(machine: Machine): void {
    this.machines.push(machine);
  }

  public removeMachine(machine: Machine): void {
    this.machines = this.machines.filter((m) => m.id !== machine.id);
  }

  handle(event: IEvent): void {
    const machineIndex = this.machines.findIndex(
      (m) => m.id === event.machineId()
    );
    if (machineIndex === -1) {
      return;
    }
    if (event instanceof MachineRefillEvent) {
      this.machines[machineIndex].stockLevel += event.getRefillQuantity();
      console.log(
        `Machine ${event.machineId()} refilled ${event.getRefillQuantity()} units`
      );
    }
  }
}

// objects
class Machine {
  public stockLevel = 10;
  public id: string;

  constructor(id: string) {
    this.id = id;
  }
}

// helpers
const randomMachine = (): string => {
  const random = Math.random() * 3;
  if (random < 1) {
    return "001";
  } else if (random < 2) {
    return "002";
  }
  return "003";
};

const eventGenerator = (): IEvent => {
  const random = Math.random();
  if (random < 0.5) {
    const saleQty = Math.random() < 0.5 ? 1 : 2; // 1 or 2
    return new MachineSaleEvent(saleQty, randomMachine());
  }
  const refillQty = Math.random() < 0.5 ? 3 : 5; // 3 or 5
  return new MachineRefillEvent(refillQty, randomMachine());
};

// program
(async () => {
  // create 3 machines with a quantity of 10 stock
  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];

  // create a machine sale event subscriber. inject the machines (all subscribers should do this)
  const saleSubscriber = new MachineSaleSubscriber(machines);

  const refillSubscriber = new MachineRefillSubscriber(machines);

  // create the PubSub service
  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();

  // subscribe the sale subscriber to 'sale' events
  pubSubService.subscribe("sale", saleSubscriber);

  // subscribe the refill subscriber to 'refill' events
  pubSubService.subscribe("refill", refillSubscriber);

  // create 5 random events
  const events = [1, 2, 3, 4, 5].map((i) => eventGenerator());
  for (const e of events) {
    console.log(`event: ${e.type()} for machine ${e.machineId()}`);
  }

  // publish the events
  events.forEach((event) => {
    pubSubService.publish(event);
  });


  // random unsubscribe one of the sales subscriber's machines
  const machineToUnsubscribe = randomMachine();
  const machineObj = machines.find((m) => m.id === machineToUnsubscribe);
  console.log(
    `\nRemoving machine ${machineToUnsubscribe} from sale subscriber\n`
  );
  saleSubscriber.removeMachine(machineObj!);

  // create 5 random events
  const afterMachineRemovedEvents = [1, 2, 3, 4, 5].map((i) =>
    eventGenerator()
  );
  console.log("\nEvents after machine removal:\n");
  for (const e of afterMachineRemovedEvents) {
    console.log(`event: ${e.type()} for machine ${e.machineId()}`);
  }

  // publish the events
  afterMachineRemovedEvents.forEach((event) => {
    pubSubService.publish(event);
  });

  // unsubscribe the sale subscriber from 'sale' events
  pubSubService.unsubscribe("sale", saleSubscriber);

  console.log("\nAfter unsubscribing sale subscriber:\n");

  // create 5 random events
  const afterUnsubscribedEvents = [1, 2, 3, 4, 5].map((i) => eventGenerator());
  for (const e of afterUnsubscribedEvents) {
    console.log(`event: ${e.type()} for machine ${e.machineId()}`);
  }

  // publish the events
  afterUnsubscribedEvents.forEach((event) => {
    pubSubService.publish(event);
  });
})();
