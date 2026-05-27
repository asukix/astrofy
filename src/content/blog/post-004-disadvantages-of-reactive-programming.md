---
title: "Disadvantages of reactive programming"
description: "The Observer is good when we need to react to an event, but it comes at a price."
pubDate: "Sep 20 2025"
heroImage: "/post_img.webp"
---

# The hidden costs of reactive programming: control and ownership in Combine

Reactive programming is good and useful. We know a lot of its advantages. I'd like to show some disadvantages too — hopefully this helps you use the technique in the right way.

## Control

When you use an observer pattern like Combine, in my opinion you should think about **control**. Some questions to ask:

- Who is the owner of the data?
- Who can update it?
- What is the right way to update it?
- Do you need any transformation?
- Do you need validation?
- Who can read it?

## Example

Here is an example. You have a `CurrentValueSubject` that will notify observers about the number of items in the basket.

```swift
var itemsNumberInBasket: CurrentValueSubject<Int, Never> { get }
```

### Who should be the owner?

The owner is the module that created it. For example, we have a `SimpleCartQuantityPublisher` module that creates and owns it.

```swift
final class SimpleCartQuantityPublisher {
    static let shared = SimpleCartQuantityPublisher()

    let quantitySubject = CurrentValueSubject<Int, Never>(0)

    // ...
}
```

### Who can modify it?

If everyone can `send` a value and everyone can `sink` to it, then it becomes a common shared resource — there is no single owner. In this case I want the calculator to own it, so I use `private(set)`. That way the calculator owns it and is also the only one that can modify it.

```swift
class ControlledItemCalculator {
    private(set) var itemsNumberInBasket: CurrentValueSubject<Int, Never>
    // ...
}
```

### Why is this good?

In this case the module has control over the Combine stream. It can decide how to send data, add validation, and so on. We have control — but do we really need it?

If the logic is simple — one module sends a number and another sinks to it — the simpler version is enough. When the logic is more complicated and needs controlled or validated updates, we should reach for the controlled variant.

## Simple logic example

```swift
struct ShoppingItem {
    let id: String = UUID().uuidString
    let name: String
    let price: Int
    let quantity: Int
}

final class SimpleCartQuantityPublisher {
    static let shared = SimpleCartQuantityPublisher()

    let quantitySubject = CurrentValueSubject<Int, Never>(0)

    private init() {}

    var quantityPublisher: AnyPublisher<Int, Never> {
        quantitySubject.eraseToAnyPublisher()
    }
}

class ShoppingUseCase {
    func buyItem(item: ShoppingItem) {
        addItemToBasket(item: item)
        updateQuantity(with: item)
        fetchBasket()
    }

    private func updateQuantity(with item: ShoppingItem) {
        let currentQuantity = SimpleCartQuantityPublisher.shared.quantitySubject.value
        let updatedQuantity = currentQuantity + item.quantity
        SimpleCartQuantityPublisher.shared.quantitySubject.send(updatedQuantity)
    }

    private func fetchBasket() {
        // ...
    }

    private func addItemToBasket(item: ShoppingItem) {
        // ...
    }
}

class CartViewModel: ObservableObject, Identifiable {
    @Published var itemsNumberInBasket: Int = 0
    private var subscriptions = Set<AnyCancellable>()

    init() {
        SimpleCartQuantityPublisher.shared.quantitySubject
            .debounce(for: .seconds(1), scheduler: DispatchQueue.main)
            .sink { [weak self] current in
                self?.itemsNumberInBasket = current
            }
            .store(in: &subscriptions)
    }
}

class ShoppingPageViewModel: ObservableObject, Identifiable {
    var shoppingItems: [ShoppingItem] = []
    let shoppingUseCase: ShoppingUseCase

    init(shoppingItems: [ShoppingItem]) {
        self.shoppingItems = shoppingItems
        self.shoppingUseCase = ShoppingUseCase()
    }

    func didTapOnAdd(index: Int) {
        let item = shoppingItems[index]
        shoppingUseCase.buyItem(item: item)
    }
}
```

> The example would be better with dependency injection. In this case I think this is enough to illustrate the point.

For this simple example, my answers to the control questions are:

- **Who is the owner of the data?** — The `ShoppingUseCase`.
- **Who can update it?** — Everyone. The use case updates it, but anyone could. There is only one update path, so it's fine for now.
- **What is the right way to update it?** — The modification is simple: just send the updated value.
- **Do you need any transformation?** — No.
- **Do you need validation?** — No.
- **Who can read it?** — Anyone. The `CartViewModel` observes it.

## Controlled logic example

Let's add some extra requirements:

- The user can add a paper bag to the basket as an extra.
- The paper bag is free in the shop.
- We don't want to count the paper bag's quantity in the cart number.

In this case we don't want to expose this logic to other modules. For example, if the app has a reorder function, it shouldn't have to know how to send the new number.

```swift
class Reorder {
    var reorderItems: [ShoppingItem] = []

    func reorderItem(item: ShoppingItem) {
        // Reorder logic
        // ...
    }

    func addItemsToBasket() {
        // Update basket logic where we send the reorderItems
        // ...

        // Bad Combine example
        SimpleCartQuantityPublisher.shared.quantitySubject.send(reorderItemsTotalQuantity())
    }

    func reorderItemsTotalQuantity() -> Int {
        return reorderItems
            .map { $0.quantity }
            .reduce(0, +)
    }
}
```

In the *"Bad Combine example"* you can see that we update the cart quantity without checking the current value. In a small codebase this is an easy bug to fix. But in a larger codebase it's hard to figure out what causes the issue. A **controlled** publisher can help here — so let's modify our publisher:

```swift
class ItemCalculator {
    static func calculateTotalQuantity(from items: [ShoppingItem]) -> Int {
        return items
            .map { $0.quantity }
            .reduce(0, +)
    }
}

final class ControlledCartQuantityPublisher {
    static let shared = ControlledCartQuantityPublisher()

    private let quantitySubject = CurrentValueSubject<Int, Never>(0)

    private init() {}

    var quantityPublisher: AnyPublisher<Int, Never> {
        quantitySubject
            .removeDuplicates()
            .eraseToAnyPublisher()
    }

    func updateQuantity(with items: [ShoppingItem]) {
        let currentQuantity = quantitySubject.value
        let incomingQuantity = ItemCalculator.calculateTotalQuantity(from: items)
        let updatedQuantity = currentQuantity + incomingQuantity

        quantitySubject.send(updatedQuantity)
    }
}
```

> This would be even better if `ShoppingItem` updates also flowed through Combine, but I think the current form is enough to make the point.

In `ControlledCartQuantityPublisher`, anyone can still update and read data from the publisher — but only through a controlled API. Why is this good?

- The code is easier to maintain.
- The publisher is easier to use — consumers don't have to know *how* it updates the stream.
- It encapsulates the logic.
- Reusability improves.
- The app scales better.

In another article I'll add more examples and logic.
