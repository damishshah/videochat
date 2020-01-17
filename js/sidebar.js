import React, { Component } from 'react';
import Sidebar from "react-sidebar";
import {sendData} from "./main"

class SideBar extends Component {
  constructor(props) {
    super(props);
    this.state = {
      sidebarOpen: true,
      name: "",
      message: ""
    };
    this.onSetSidebarOpen = this.onSetSidebarOpen.bind(this);
    this.handleMessageSubmit = this.handleMessageSubmit.bind(this);
    this.handleNameChange = this.handleNameChange.bind(this);
    this.handleMessageChange = this.handleMessageChange.bind(this);
  }
 
  onSetSidebarOpen(open) {
    this.setState({ sidebarOpen: open });
  }

  handleMessageSubmit(event) {
    console.log("Trying to send name (" + this.state.name + ") and message (" + this.state.message + ") from react component.")
    sendData(this.state.name, this.state.message);
  }
 
  handleMessageChange(event) {
    this.setState({ message: event.target.value });
  }

  handleNameChange(event) {
    this.setState({ name: event.target.value });
  }

  render() {
    return (
      <Sidebar
        sidebar={      
          <div id="chatWindow"  style={{position:'relative', margin:'10px'}}>
            <div style={{fontStyle:'oblique'}}>
              Your name: 
              <input 
                id="name" 
                type="text" 
                placeholder="Enter your name here"
                onChange={this.handleNameChange}>
              </input>
            </div>
            <div class="messaging">
              <div id="dataChannelReceive" class="messages">

              </div>
              <form className="footer" onSubmit={this.handleMessageSubmit}>
                <input 
                  id="dataChannelSend" 
                  type="text" 
                  value={this.state.message} 
                  onChange={this.handleMessageChange}
                  placeholder="Your message..">
                </input>
                <button type="submit">Send</button>
              </form>
            </div>
          </div>
        }
        open={this.state.sidebarOpen}
        onSetOpen={this.onSetSidebarOpen}
        styles={{ sidebar: { background: "white" } }}
      >
        <button onClick={() => this.onSetSidebarOpen(true)}>
          Open sidebar
        </button>
      </Sidebar>
    );
  }
}
 
export default SideBar;