---
title: "MVVM Model confusions"
description: "I had some confusions in MVVM around models."
heroImage: "/mvvm-model-confusions-card.svg"
pubDate: "Mar 16 2026"
---

I'd like to share some misunderstandings I had about the Model in MVVM. These are my own misconceptions — maybe they'll help you too.

## MVVM very short recap

MVVM was created by Microsoft and they have a very good and detailed description of it — I recommend reading it.

Elements of MVVM in a nutshell:

- **Model:** business logic
- **View:** UI
- **ViewModel:** the connection between them

Let's take a simple app where the user can order food and the cart shows the selected items.

<Image format="png" width={300} height={300} src="/mvvm-app-example.png" alt="Simple food ordering app example" />

We also have a `ViewModel` for items that contains data for presentation and some simple logic.

```swift
import Foundation
import Combine

class MenuItemViewModel: ObservableObject {

    // MARK: - Item data (no separate Model)
    @Published var id: UUID
    @Published var name: String
    @Published var price: Double
    @Published var notes: [String]
    @Published var iconName: String
    @Published var quantity: Int

    init(
        id: UUID = UUID(),
        name: String,
        price: Double,
        notes: [String],
        iconName: String,
        quantity: Int = 0
    ) {
        self.id = id
        self.name = name
        self.price = price
        self.notes = notes
        self.iconName = iconName
        self.quantity = quantity
    }

    // MARK: - Presentation logic
    // The ViewModel is also responsible for formatting data for the UI

    var priceString: String {
        String(format: "$%.2f", price)
    }

    var hasOptions: Bool {
        !notes.isEmpty
    }

    // MARK: - Actions

    func increment() {
        quantity += 1
    }

    func decrement() {
        guard quantity > 0 else { return }
        quantity -= 1
    }
}
```

You can notice quite a few properties in the view model:

```swift
@Published var id: UUID
@Published var name: String
@Published var price: Double
@Published var notes: [String]
@Published var iconName: String
@Published var quantity: Int
```

Let's make the situation a bit more complicated. For example, the cart logic starts growing, and we also want some analytics logic to log events. We decide to use use cases and repositories to keep the application clean. Since the view model uses this data, we want to separate the properties out into a model type.

```swift
import Foundation

// MARK: - MenuItemModel
struct MenuItemModel: Identifiable {
    let id: UUID
    let name: String
    let price: Double
    let notes: [String]
    let iconName: String
    var quantity: Int
}
```

Looks better, right? Okay, let's also create the use cases, like `IncrementItemQuantityUseCase`:

```swift
import Foundation

protocol IncrementItemQuantityUseCase {
    func execute(itemId: UUID) async -> MenuItemModel?
}

class DefaultIncrementItemQuantityUseCase: IncrementItemQuantityUseCase {
    private let repository: MenuItemRepository

    init(repository: MenuItemRepository) {
        self.repository = repository
    }

    func execute(itemId: UUID) async -> MenuItemModel? {
        return await repository.incrementQuantity(itemId: itemId)
    }
}
```

We also have a simple repository:

```swift
import Foundation

protocol MenuItemRepository {
    func fetchAllItems() async -> [MenuItemModel]
    func incrementQuantity(itemId: UUID) async -> MenuItemModel?
    func decrementQuantity(itemId: UUID) async -> MenuItemModel?
    func deleteItem(itemId: UUID) async -> Bool
}

class LocalMenuItemRepository: MenuItemRepository {
    private var items: [MenuItemModel]

    init(items: [MenuItemModel]) {
        self.items = items
    }

    func fetchAllItems() async -> [MenuItemModel] {
        return items
    }

    func incrementQuantity(itemId: UUID) async -> MenuItemModel? {
        guard let index = items.firstIndex(where: { $0.id == itemId }) else {
            return nil
        }

        let currentItem = items[index]
        let updatedItem = MenuItemModel(
            id: currentItem.id,
            name: currentItem.name,
            price: currentItem.price,
            notes: currentItem.notes,
            iconName: currentItem.iconName,
            quantity: currentItem.quantity + 1
        )

        items[index] = updatedItem
        // TODO: Save to DB (Core Data, SwiftData, etc.)

        return updatedItem
    }

    // More repository functions ...
}
```

And we also refactor the view model:

```swift
import Foundation
import Combine

class MenuViewModel: ObservableObject {
    @Published var items: [MenuItemModel] = []

    private let repository: MenuItemRepository
    private let incrementUseCase: IncrementItemQuantityUseCase
    private let decrementUseCase: DecrementItemQuantityUseCase
    private let deleteUseCase: DeleteItemUseCase

    init(
        repository: MenuItemRepository,
        incrementUseCase: IncrementItemQuantityUseCase,
        decrementUseCase: DecrementItemQuantityUseCase,
        deleteUseCase: DeleteItemUseCase
    ) {
        self.repository = repository
        self.incrementUseCase = incrementUseCase
        self.decrementUseCase = decrementUseCase
        self.deleteUseCase = deleteUseCase

        Task {
            await loadItems()
        }
    }

    private func index(for id: UUID) -> Int? {
        items.firstIndex(where: { $0.id == id })
    }

    func itemTitle(id: UUID) -> String {
        guard let idx = index(for: id) else { return "Unknown Item" }
        return items[idx].name
    }

    func itemPrice(id: UUID) -> Double {
        guard let idx = index(for: id) else { return 0.0 }
        return items[idx].price
    }

    func itemPriceString(id: UUID) -> String {
        guard let idx = index(for: id) else { return "Unknown Price" }
        return String(format: "$%.2f", items[idx].price)
    }

    func itemOptions(id: UUID) -> [String] {
        guard let idx = index(for: id) else { return [] }
        return items[idx].notes
    }

    func itemQuantity(id: UUID) -> Int {
        guard let idx = index(for: id) else { return 0 }
        return items[idx].quantity
    }

    func incrementQuantity(id: UUID) {
        Task {
            if let updatedItem = await incrementUseCase.execute(itemId: id),
               let index = items.firstIndex(where: { $0.id == id }) {
                await MainActor.run {
                    items[index] = updatedItem
                }
            }
        }
    }

    // and more VM functions ...
}
```

We have a cleaner solution now.

## My question

What is the `MenuItemModel`, that is used by `MenuViewModel`?

My first answer was this: it's the Model from MVVM (Model–View–ViewModel). I have a View, a ViewModel, and now also a Model.

## Architecture

Okay, I said it's the Model from MVVM — but let's check the architecture. The View uses the ViewModel, the ViewModel uses the model and the use cases (yes, it also uses the repository in this example, and it shouldn't in Clean Architecture), and the use cases use the repository.

<Image format="png" width={300} height={300} src="/mvvm-layers.png" alt="MVVM combined with Clean Architecture layers" />

Let's check what we actually have here. The presentation layer contains the View and the ViewModel — that part is clear. But what about the Model from MVVM? MVVM defines the Model as the layer responsible for business logic. In our case, that business logic lives in the domain layer, represented by use cases and the repository.

So what happened is that we combined MVVM with Clean Architecture. The View and ViewModel remain in the presentation layer, while the business logic — what MVVM would simply call the Model — is now structured into use cases and a repository. The naming changed, but the responsibility is the same.

So here's my question again: **what is the `MenuItemModel`?**

## My second answer

The "Model" naming is a bit confusing, because `MenuItemModel` was created only for storing data. It does not contain business logic. So it is really a Data Transfer Object (DTO) with a misleading "model" name — or more precisely, what Martin Fowler calls a **Presentation Model**: an object that holds and shapes data specifically for the UI, not for business logic.

So the `MenuItemModel` is *not* the Model from MVVM. It lives at the boundary between the presentation layer and the domain layer, carrying data between them — nothing more.

## So what is the Model in MVVM really?

MVVM is a UI architecture pattern. It defines how the View, the ViewModel, and the Model relate to each other in the presentation layer — but it doesn't tell you how to structure your business logic. When you combine MVVM with Clean Architecture, the "Model" from MVVM gets replaced by a proper domain layer with use cases and a repository. What remains in the presentation layer is not a Model in the MVVM sense — it is a Presentation Model or DTO, responsible only for carrying data to the UI.

Naming matters. Calling it a Model suggests more responsibility than it actually has.
