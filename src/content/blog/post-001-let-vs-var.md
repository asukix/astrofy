---
title: "Swift's Let vs var:  Beyond immutable vs mutable"
description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
pubDate: "Apr 19 2025"
heroImage: "/post_img.webp"
---

# What is the real difference between `let` and `var` in Swift?

The first and the usual answer is: `let` is immutable, `var` is mutable.

Here's a breakdown of the key differences between `let` and `var`, grouped by aspects:

- Usage
- Performance
- Safety and threading

## Usage

`let` is used like a constant, while `var` represents values that may change. The compiler also helps you: if you don't change the value but declared your variable as `var`, you will get a SwiftLint warning.

### Definition

When you define a new variable, in the case of `var` your freedom is higher:

- `let` is immutable, `var` is mutable. In the case of a primitive type, `let` is a constant. However, if an object is created with `let`, its values can be modified depending on its definition:

  ```swift
  public class ObjTest {
      var x: Int
      let y: Int

      init(x: Int, y: Int) {
          self.x = x
          self.y = y
      }
  }

  // usage
  let o1 = ObjTest(x: 3, y: 4)
  o1.y = 6 // won't work
  o1.x = 7 // you can do it as o1 is a reference type
  ```

- Contrary to the original assumption, `let` can be used with optionals. However, using `let` with an optional only makes sense if you're not planning to reassign the value. It's useful when you want to declare a constant that will be initialized once, possibly with a delayed assignment (e.g., during initialization), but not changed afterward.

- Computed properties can't be `let`. However, if a property doesn't change and is just a very simple constant calculation, it can only be `var`:

  ```swift
  let answerToLife: Int { 6 * 7 } // logically ok, but you can't do this
  ```

- `let` can't be declared in a convenience init, as its value should be set in the designated init.

## Performance

### Small optimization

When you create a variable and don't change its value, Xcode will warn you that you should change its declaration. You can leave it as it's just a warning.

Why is this important if you just create it and access its value?

The compiler can optimize memory and CPU usage better for values declared with `let`, since it guarantees immutability.

Yes, it's a small thing, but a lot of small performance optimizations can make for better quality.

### ARC

Yes, there is a difference in reference counting. What do you think the lifecycle of a variable is in the aspect of reference count?

- When you use `let`, the reference count will decrease when the block that created it ends.
- And what can `var` do that `let` can't? Change its value. And how can that decrease the reference count?
  - You can change the value of a `var` variable (if it is optional) to `nil`. (Yes, it's also a small thing, but a lot of small things can have a great effect.)

For example, when you create an object-level variable you can initialize it, and when you know you don't need its value anymore — or you need to know that it is missing — you can set it to `nil`. Imagine you have an app that shows a notification to the user when they start the app. You want to show it and make sure they will read it. The user taps on it, the message opens, and you can set the message notification to `nil`. When it's `nil`, you'll know you don't have to show it. (The notification could be, for example, a small object that creates a somewhat complex message with some info.)

```swift
var notification: MessageNotification? = ...

// After showing it
notification = nil
// drops the reference
```

You can also assign a new object to the `var`. For example, when you iterate over an array: when the `var` gets a new value, the old object's reference count will decrease.

## Safety and threading

`let` is immutable, therefore it cannot cause a race condition. There can never be a situation where 2 or more threads try to write it.

If you use `let` to read its value in a thread, it's constant, so it will always show the same value. For example, if you have a string for showing a specific toast message to the user, you will always show the same message if you use `let`.

`var` is mutable, so if you want to read its value in a thread, it can also take a bad value. For example: the user taps on a button. You start a thread, and in the thread you set a flag with the name `isFetchStarted` to `true`. After that, you check if `!isFetchStarted` and then do something. If the user taps the button quickly, 2 or more threads can be started and start the fetch.
